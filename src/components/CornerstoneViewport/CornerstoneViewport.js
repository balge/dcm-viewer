import React, { Component } from 'react'
import PropTypes from 'prop-types'
import classNames from 'classnames'
import ViewportOverlay from '../ViewportOverlay/ViewportOverlay.js'
import cornerstone from 'cornerstone-core'
import cornerstoneTools from 'cornerstone-tools'
import ReactResizeDetector from 'react-resize-detector'
import debounce from 'lodash.debounce'

// Util
import areStringArraysEqual from '../../helpers/areStringArraysEqual.js'

import './CornerstoneViewport.css'

const addToBeginning = true
const priority = -5
const requestType = 'interaction'

const scrollToIndex = cornerstoneTools.importInternal('util/scrollToIndex')
const { loadHandlerManager } = cornerstoneTools

class CornerstoneViewport extends Component {
  static propTypes = {
    imageIds: PropTypes.arrayOf(PropTypes.string).isRequired,
    imageIdIndex: PropTypes.number,
    // Controlled
    activeTool: PropTypes.string,
    tools: PropTypes.arrayOf(
      PropTypes.oneOfType([
        // String
        PropTypes.string,
        // Object
        PropTypes.shape({
          name: PropTypes.string, // Tool Name
          toolClass: PropTypes.func, // Custom (ToolClass)
          props: PropTypes.object, // Props to Pass to `addTool`
          mode: PropTypes.string, // Initial mode, if one other than default
          modeOptions: PropTypes.object, // { mouseButtonMask: [int] }
        }),
      ])
    ),
    // Optional
    // isActive ?? classname -> active
    children: PropTypes.node,
    cornerstoneOptions: PropTypes.object, // cornerstone.enable options
    isStackPrefetchEnabled: PropTypes.bool, // should prefetch?
    // CINE
    isPlaying: PropTypes.bool,
    frameRate: PropTypes.number, // Between 1 and ?
    //
    initialViewport: PropTypes.object,
    setViewportActive: PropTypes.func, // Called when viewport should be set to active?
    onNewImage: PropTypes.func,
    onNewImageDebounced: PropTypes.func,
    onNewImageDebounceTime: PropTypes.number,
    viewportOverlayComponent: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.func,
    ]),
    // Cornerstone Events
    onElementEnabled: PropTypes.func, // Escape hatch
    eventListeners: PropTypes.arrayOf(
      PropTypes.shape({
        target: PropTypes.oneOf(['element', 'cornerstone']).isRequired,
        eventName: PropTypes.string.isRequired,
        handler: PropTypes.func.isRequired,
      })
    ),
    startLoadHandler: PropTypes.func,
    endLoadHandler: PropTypes.func,
    loadIndicatorDelay: PropTypes.number,
    /** false to enable automatic viewport resizing */
    enableResizeDetector: PropTypes.bool,
    /** rate at witch to apply resize mode's logic */
    resizeRefreshRateMs: PropTypes.number,
    /** whether resize refresh behavior is exhibited as throttle or debounce */
    resizeRefreshMode: PropTypes.oneOf(['throttle', 'debounce']),
    //
    style: PropTypes.object,
    className: PropTypes.string,
    isOverlayVisible: PropTypes.bool,
    orientationMarkers: PropTypes.arrayOf(PropTypes.string),
  }

  static defaultProps = {
    // Watch
    imageIdIndex: 0,
    isPlaying: false,
    cineFrameRate: 24,
    viewportOverlayComponent: ViewportOverlay,
    imageIds: [],
    initialViewport: {},
    // Init
    cornerstoneOptions: {},
    isStackPrefetchEnabled: false,
    isOverlayVisible: true,
    loadIndicatorDelay: 45,
    enableResizeDetector: true,
    resizeRefreshRateMs: 200,
    resizeRefreshMode: 'debounce',
    tools: [],
    onNewImageDebounceTime: 0,
    orientationMarkers: ['top', 'left'],
  }

  constructor(props) {
    super(props)

    const imageIdIndex = props.imageIdIndex
    const imageId = props.imageIds[imageIdIndex]
    const isOverlayVisible = props.isOverlayVisible

    this.state = {
      // Used for metadata lookup (imagePlane, orientation markers)
      // We can probs grab this once and hold on to? (updated on newImage)
      imageId,
      imageIdIndex, // Maybe
      imageProgress: 0,
      error: null,
      // Overlay
      scale: 1,
      windowWidth: 1500,
      windowCenter: -400,
      isOverlayVisible,
      posx: 0,
      posy: 0,
      // Orientation Markers
      rotationDegrees: undefined,
      isFlippedVertically: undefined,
      isFlippedHorizontally: undefined,
    }

    this._validateExternalEventsListeners()

    // TODO: Deep Copy? How does that work w/ handlers?
    // Save a copy. Props could change before `willUnmount`
    this.startLoadHandler = this.props.startLoadHandler
    this.endLoadHandler = this.props.endLoadHandler
    this.loadHandlerTimeout = undefined // "Loading..." timer

    this.numImagesLoaded = 0
  }

  // ~~ LIFECYCLE
  async componentDidMount() {
    const {
      tools,
      isStackPrefetchEnabled,
      cornerstoneOptions,
      imageIds,
      isPlaying,
      frameRate,
      initialViewport,
    } = this.props
    const { imageIdIndex } = this.state
    const imageId = imageIds[imageIdIndex]

    // ~~ EVENTS: CORNERSTONE
    this._handleOnElementEnabledEvent()
    this._bindInternalCornerstoneEventListeners()
    this._bindExternalEventListeners('cornerstone')

    cornerstone.enable(this.element, cornerstoneOptions)

    // ~~ EVENTS: ELEMENT
    this._bindInternalElementEventListeners()
    this._bindExternalEventListeners('element')

    try {
      // Setup "Stack State"
      cornerstoneTools.clearToolState(this.element, 'stack')
      cornerstoneTools.addStackStateManager(this.element, [
        'stack',
        'playClip',
        'referenceLines',
      ])
      cornerstoneTools.addToolState(this.element, 'stack', {
        imageIds: [...imageIds],
        currentImageIdIndex: imageIdIndex,
      })

      // Load first image in stack
      const options = {
        addToBeginning,
        priority,
      }

      const requestFn = (imageId, options) => {
        return cornerstone.loadAndCacheImage(imageId, options).then((image) => {
          cornerstone.displayImage(this.element, image, initialViewport)
        })
      }

      // 1. Load the image using the ImageLoadingPool
      cornerstone.imageLoadPoolManager.addRequest(
        requestFn.bind(this, imageId, options),
        requestType,
        {
          imageId,
        },
        priority,
        addToBeginning
      )

      if (isStackPrefetchEnabled) {
        cornerstoneTools.stackPrefetch.enable(this.element)
      }

      if (isPlaying) {
        const validFrameRate = Math.max(frameRate, 1)
        cornerstoneTools.playClip(this.element, validFrameRate)
      }

      _addAndConfigureInitialToolsForElement(tools, this.element)
      _trySetActiveTool(this.element, this.props.activeTool)
      this.handleCanvesEventListener()
    } catch (error) {
      console.log(error, 'error')
    }
  }

  async componentDidUpdate(prevProps, prevState) {
    // ~~ STACK/IMAGE
    const {
      imageIds: stack,
      imageIdIndex: imageIndex,
      isStackPrefetchEnabled,
      initialViewport,
    } = this.props
    const {
      imageIds: prevStack,
      imageIdIndex: prevImageIndex,
      isStackPrefetchEnabled: prevIsStackPrefetchEnabled,
    } = prevProps
    const hasStackChanged = !areStringArraysEqual(prevStack, stack)
    const hasImageIndexChanged =
      imageIndex != null && imageIndex !== prevImageIndex
    let updatedState = {}

    if (hasStackChanged) {
      // update stack toolstate
      cornerstoneTools.clearToolState(this.element, 'stack')
      cornerstoneTools.addToolState(this.element, 'stack', {
        imageIds: [...stack],
        currentImageIdIndex: imageIndex || 0,
      })

      // New stack; reset counter
      updatedState['numImagesLoaded'] = 0
      updatedState['error'] = null // Reset error on new stack

      try {
        // load + display image
        const imageId = stack[imageIndex || 0]
        cornerstoneTools.stopClip(this.element)
        const requestFn = (imageId, options) => {
          return cornerstone
            .loadAndCacheImage(imageId, options)
            .then((image) => {
              cornerstone.displayImage(this.element, image, initialViewport)
              cornerstone.reset(this.element)
            })
        }

        cornerstone.imageLoadPoolManager.addRequest(
          requestFn.bind(this, imageId, { addToBeginning, priority }),
          requestType,
          {
            imageId,
          },
          priority,
          addToBeginning
        )
      } catch (err) {
        // :wave:
        // What if user kills component before `displayImage`?
      }
    } else if (!hasStackChanged && hasImageIndexChanged) {
      scrollToIndex(this.element, imageIndex)
    }

    const shouldStopStartStackPrefetch =
      (isStackPrefetchEnabled && hasStackChanged) ||
      (!prevIsStackPrefetchEnabled && isStackPrefetchEnabled === true)

    // Need to stop/start to pickup stack changes in prefetcher
    if (shouldStopStartStackPrefetch) {
      cornerstoneTools.stackPrefetch.enable(this.element)
    }

    // ~~ ACTIVE TOOL
    const { activeTool } = this.props
    const { activeTool: prevActiveTool } = prevProps
    const hasActiveToolChanges = activeTool !== prevActiveTool

    if (hasActiveToolChanges) {
      _trySetActiveTool(this.element, activeTool)
    }

    // ~~ CINE
    const { frameRate, isPlaying, isOverlayVisible } = this.props
    const {
      frameRate: prevFrameRate,
      isPlaying: prevIsPlaying,
      isOverlayVisible: prevIsOverlayVisible,
    } = prevProps
    const validFrameRate = Math.max(frameRate, 1)
    const shouldStart =
      (isPlaying !== prevIsPlaying && isPlaying) ||
      (isPlaying && hasStackChanged)
    const shouldPause = isPlaying !== prevIsPlaying && !isPlaying
    const hasFrameRateChanged = isPlaying && frameRate !== prevFrameRate

    if (shouldStart || hasFrameRateChanged) {
      cornerstoneTools.playClip(this.element, validFrameRate)
    } else if (shouldPause) {
      cornerstoneTools.stopClip(this.element)
    }

    // ~~ OVERLAY
    if (isOverlayVisible !== prevIsOverlayVisible)
      updatedState.isOverlayVisible = isOverlayVisible

    // ~~ STATE: Update aggregated state changes
    if (Object.keys(updatedState).length > 0) {
      this.setState(updatedState)
    }

    this._validateExternalEventsListeners()
  }

  /**
   * Tear down any listeners/handlers, and stop any asynchronous/queued operations
   * that could fire after Unmount and cause errors.
   *
   * @memberof CornerstoneViewport
   * @returns {undefined}
   */
  componentWillUnmount() {
    const clear = true

    this._handleOnElementEnabledEvent(clear)
    this._bindInternalCornerstoneEventListeners(clear)
    this._bindInternalElementEventListeners(clear)
    this._bindExternalEventListeners('cornerstone', clear)
    this._bindExternalEventListeners('element', clear)

    if (this.props.isStackPrefetchEnabled) {
      cornerstoneTools.stackPrefetch.disable(this.element)
    }

    cornerstoneTools.clearToolState(this.element, 'stackPrefetch')
    cornerstoneTools.stopClip(this.element)
    cornerstone.disable(this.element)
  }
  /**
   *
   *
   * @returns
   * @memberof CornerstoneViewport
   */
  getOverlay() {
    const { viewportOverlayComponent: Component, imageIds } = this.props
    const {
      imageIdIndex,
      scale,
      windowWidth,
      windowCenter,
      isOverlayVisible,
      posx,
      posy,
    } = this.state
    const imageId = imageIds[imageIdIndex]
    console.log()
    return (
      imageId &&
      windowWidth &&
      isOverlayVisible && (
        <Component
          imageIndex={imageIdIndex + 1}
          stackSize={imageIds.length}
          scale={scale}
          windowWidth={windowWidth}
          windowCenter={windowCenter}
          posx={posx}
          posy={posy}
          imageId={imageId}
        />
      )
    )
  }

  /**
   *
   *
   * @param {boolean} [clear=false] - True to clear event listeners
   * @memberof CornerstoneViewport
   * @returns {undefined}
   */
  _bindInternalCornerstoneEventListeners(clear = false) {
    const addOrRemoveEventListener = clear
      ? 'removeEventListener'
      : 'addEventListener'

    // Update image load progress
    cornerstone.events[addOrRemoveEventListener](
      'cornerstoneimageloadprogress',
      this.onImageProgress
    )

    // Update number of images loaded
    cornerstone.events[addOrRemoveEventListener](
      cornerstone.EVENTS.IMAGE_LOADED,
      this.onImageLoaded
    )
  }

  /**
   *
   *
   * @param {boolean} [clear=false] - True to clear event listeners
   * @memberof CornerstoneViewport
   * @returns {undefined}
   */
  _bindInternalElementEventListeners(clear = false) {
    const addOrRemoveEventListener = clear
      ? 'removeEventListener'
      : 'addEventListener'

    // Updates state's imageId, and imageIndex
    this.element[addOrRemoveEventListener](
      cornerstone.EVENTS.NEW_IMAGE,
      this.onNewImage
    )

    // Updates state's imageId, and imageIndex
    this.element[addOrRemoveEventListener](
      cornerstone.EVENTS.NEW_IMAGE,
      this.onNewImageDebounced
    )

    // Updates state's viewport
    this.element[addOrRemoveEventListener](
      cornerstone.EVENTS.IMAGE_RENDERED,
      this.onImageRendered
    )

    // Set Viewport Active
    this.element[addOrRemoveEventListener](
      cornerstoneTools.EVENTS.MOUSE_CLICK,
      this.setViewportActive
    )
    this.element[addOrRemoveEventListener](
      cornerstoneTools.EVENTS.MOUSE_DOWN,
      this.setViewportActive
    )
    this.element[addOrRemoveEventListener](
      cornerstoneTools.EVENTS.TOUCH_PRESS,
      this.setViewportActive
    )
    this.element[addOrRemoveEventListener](
      cornerstoneTools.EVENTS.TOUCH_START,
      this.setViewportActive
    )
    this.element[addOrRemoveEventListener](
      cornerstoneTools.EVENTS.STACK_SCROLL,
      this.setViewportActive
    )
  }

  /**
   * TODO: The ordering here will cause ELEMENT_ENABLED and ELEMENT_DISABLED
   *       events to never fire. We should have explicit callbacks for these,
   *       and warn appropriately if user attempts to use them with this prop.
   *
   *
   * Listens out for all events and then defers handling to a single listener to
   * act on them
   *
   * @param {string} target - "cornerstone" || "element"
   * @param {boolean} [clear=false] - True to clear event listeners
   * @returns {undefined}
   */
  _bindExternalEventListeners(targetType, clear = false) {
    const addOrRemoveEventListener = clear
      ? 'removeEventListener'
      : 'addEventListener'

    // Unique list of event names
    const cornerstoneEvents = Object.values(cornerstone.EVENTS)
    const cornerstoneToolsEvents = Object.values(cornerstoneTools.EVENTS)
    const csEventNames = cornerstoneEvents.concat(cornerstoneToolsEvents)

    const targetElementOrCornerstone =
      targetType === 'element' ? this.element : cornerstone.events
    const boundMethod = this._handleExternalEventListeners.bind(this)

    // Bind our single handler to every cornerstone event
    for (let i = 0; i < csEventNames.length; i++) {
      targetElementOrCornerstone[addOrRemoveEventListener](
        csEventNames[i],
        boundMethod
      )
    }
  }

  /**
   * Called to validate that events passed into the event listeners prop are valid
   *
   * @returns {undefined}
   */
  _validateExternalEventsListeners() {
    if (!this.props.eventListeners) return

    const cornerstoneEvents = Object.values(cornerstone.EVENTS)
    const cornerstoneToolsEvents = Object.values(cornerstoneTools.EVENTS)

    for (let i = 0; i < this.props.eventListeners.length; i++) {
      const {
        target: targetType,
        eventName,
        handler,
      } = this.props.eventListeners[i]
      if (
        !cornerstoneEvents.includes(eventName) &&
        !cornerstoneToolsEvents.includes(eventName)
      ) {
        console.warn(
          `No cornerstone or cornerstone-tools event exists for event name: ${eventName}`
        )
        continue
      }
    }
  }
  /**
   * Handles delegating of events from cornerstone back to the defined
   * external events handlers
   *
   * @param {event}
   * @returns {undefined}
   */
  _handleExternalEventListeners(event) {
    if (!this.props.eventListeners) {
      return
    }

    for (let i = 0; i < this.props.eventListeners.length; i++) {
      const { eventName, handler } = this.props.eventListeners[i]

      if (event.type === eventName) {
        handler(event)
      }
    }
  }

  /**
   * Convenience handler to pass the "Element Enabled" event back up to the
   * parent via a callback. Can be used as an escape hatch for more advanced
   * cornerstone fucntionality.
   *
   * @memberof CornerstoneViewport
   * @returns {undefined}
   */
  _handleOnElementEnabledEvent = (clear = false) => {
    const handler = (evt) => {
      const elementThatWasEnabled = evt.detail.element
      if (elementThatWasEnabled === this.element) {
        // Pass Event
        this.props.onElementEnabled(evt)
      }
    }

    // Start Listening
    if (this.props.onElementEnabled && !clear) {
      cornerstone.events.addEventListener(
        cornerstone.EVENTS.ELEMENT_ENABLED,
        handler
      )
    }

    // Stop Listening
    if (clear) {
      cornerstone.events.removeEventListener(
        cornerstone.EVENTS.ELEMENT_ENABLED,
        handler
      )
    }
  }

  onImageRendered = (event) => {
    const viewport = event.detail.viewport

    this.setState({
      scale: viewport.scale,
      windowCenter: viewport.voi.windowCenter,
      windowWidth: viewport.voi.windowWidth,
      rotationDegrees: viewport.rotation,
      isFlippedVertically: viewport.vflip,
      isFlippedHorizontally: viewport.hflip,
    })
  }

  onNewImageHandler = (event, callback) => {
    const { imageId } = event.detail.image
    const { sopInstanceUid } =
      cornerstone.metaData.get('generalImageModule', imageId) || {}
    const currentImageIdIndex = this.props.imageIds.indexOf(imageId)

    // TODO: Should we grab and set some imageId specific metadata here?
    // Could prevent cornerstone dependencies in child components.
    this.setState({ imageIdIndex: currentImageIdIndex })

    if (callback) {
      callback({ currentImageIdIndex, sopInstanceUid })
    }
  }

  onNewImage = (event) => this.onNewImageHandler(event, this.props.onNewImage)

  onNewImageDebounced = debounce((event) => {
    this.onNewImageHandler(event, this.props.onNewImageDebounced)
  }, this.props.onNewImageDebounceTime)

  onImageLoaded = () => {
    // TODO: This is not necessarily true :thinking:
    // We need better cache reporting a layer up
    this.numImagesLoaded++
  }

  onImageProgress = (e) => {
    this.setState({
      imageProgress: e.detail.percentComplete,
    })
  }

  // imageSliderOnInputCallback = (value) => {
  //   this.setViewportActive()

  //   scrollToIndex(this.element, value)
  // }

  setViewportActive = () => {
    if (this.props.setViewportActive) {
      this.props.setViewportActive() // TODO: should take viewport index/ident?
    }
  }

  onResize = () => {
    cornerstone.resize(this.element)
  }

  handleCanvesEventListener = () => {
    console.log(this.canves, cornerstone.canvasToPixel, 2222222)
    this.element.addEventListener('mousemove', (evt) => {
      const rect = this.element.getBoundingClientRect()

      const canvasPos = {
        x: Math.floor(evt.clientX - rect.left),
        y: Math.floor(evt.clientY - rect.top),
      }
      // Convert canvas coordinates to world coordinates
      const worldPos = cornerstone.canvasToPixel(this.element, canvasPos)
      this.setState({
        posx: parseInt(worldPos.x),
        posy: parseInt(worldPos.y),
      })
    })
  }

  render() {
    return (
      <div
        style={this.props.style}
        className={classNames('viewport-wrapper', this.props.className)}
      >
        {this.props.enableResizeDetector && this.element != null && (
          <ReactResizeDetector
            handleWidth
            handleHeight
            skipOnMount={true}
            refreshMode={this.props.resizeRefreshMode}
            refreshRate={this.props.resizeRefreshRateMs}
            onResize={this.onResize}
            targetDomEl={this.element}
          />
        )}
        <div
          className="viewport-element"
          onContextMenu={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          ref={(input) => {
            this.element = input
          }}
        >
          <canvas
            className="cornerstone-canvas"
            ref={(input) => {
              this.canves = input
            }}
          />
          {this.getOverlay()}
        </div>
        {this.props.children}
      </div>
    )
  }
}

/**
 *
 *
 * @param {HTMLElement} element
 * @param {string} activeToolName
 * @returns
 */
function _trySetActiveTool(element, activeToolName) {
  if (!element || !activeToolName) {
    return
  }

  const validTools = cornerstoneTools.store.state.tools.filter(
    (tool) => tool.element === element
  )
  const validToolNames = validTools.map((tool) => tool.name)

  if (!validToolNames.includes(activeToolName)) {
    console.warn(
      `Trying to set a tool active that is not "added". Available tools include: ${validToolNames.join(
        ', '
      )}`
    )
  }

  cornerstoneTools.setToolActiveForElement(element, activeToolName, {
    mouseButtonMask: 1,
  })
}

/**
 * Iterate over the provided tools; Add each tool to the target element
 *
 * @param {string[]|object[]} tools
 * @param {HTMLElement} element
 */
function _addAndConfigureInitialToolsForElement(tools, element) {
  for (let i = 0; i < tools.length; i++) {
    const tool =
      typeof tools[i] === 'string'
        ? { name: tools[i] }
        : Object.assign({}, tools[i])
    const toolName = `${tool.name}Tool` // Top level CornerstoneTools follow this pattern

    tool.toolClass = tool.toolClass || cornerstoneTools[toolName]

    if (!tool.toolClass) {
      console.warn(`Unable to add tool with name '${tool.name}'.`)
      continue
    }

    cornerstoneTools.addToolForElement(
      element,
      tool.toolClass,
      tool.props || {}
    )

    const hasInitialMode = tool.mode && AVAILABLE_TOOL_MODES.includes(tool.mode)

    if (hasInitialMode) {
      // TODO: We may need to check `tool.props` and the tool class's prototype
      // to determine the name it registered with cornerstone. `tool.name` is not
      // reliable.
      const setToolModeFn = TOOL_MODE_FUNCTIONS[tool.mode]
      setToolModeFn(element, tool.name, tool.modeOptions || {})
    }
  }
}

const AVAILABLE_TOOL_MODES = ['active', 'passive', 'enabled', 'disabled']

const TOOL_MODE_FUNCTIONS = {
  active: cornerstoneTools.setToolActiveForElement,
  passive: cornerstoneTools.setToolPassiveForElement,
  enabled: cornerstoneTools.setToolEnabledForElement,
  disabled: cornerstoneTools.setToolDisabledForElement,
}

export default CornerstoneViewport
