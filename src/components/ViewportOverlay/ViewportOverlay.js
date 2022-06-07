import { PureComponent } from 'react'
import React from 'react'
import PropTypes from 'prop-types'
import cornerstone from 'cornerstone-core'
import dicomParser from 'dicom-parser'
import { helpers } from '../../helpers/index.js'
import './ViewportOverlay.css'

const { formatPN, formatDA, formatNumberPrecision, formatTM, isValidNumber } =
  helpers

function getCompression(imageId) {
  const generalImageModule =
    cornerstone.metaData.get('generalImageModule', imageId) || {}
  const {
    lossyImageCompression,
    lossyImageCompressionRatio,
    lossyImageCompressionMethod,
  } = generalImageModule

  if (lossyImageCompression === '01' && lossyImageCompressionRatio !== '') {
    const compressionMethod = lossyImageCompressionMethod || 'Lossy: '
    const compressionRatio = formatNumberPrecision(
      lossyImageCompressionRatio,
      2
    )
    return compressionMethod + compressionRatio + ' : 1'
  }

  return 'Lossless / Uncompressed'
}

class ViewportOverlay extends PureComponent {
  static propTypes = {
    scale: PropTypes.number.isRequired,
    windowWidth: PropTypes.oneOfType([
      PropTypes.number.isRequired,
      PropTypes.string.isRequired,
    ]),
    windowCenter: PropTypes.oneOfType([
      PropTypes.number.isRequired,
      PropTypes.string.isRequired,
    ]),
    imageId: PropTypes.string.isRequired,
    imageIndex: PropTypes.number.isRequired,
    posx: PropTypes.number.isRequired,
    posy: PropTypes.number.isRequired,
    stackSize: PropTypes.number.isRequired,
  }

  render() {
    const { imageId, scale, posx, posy } = this.props

    if (!imageId) {
      return null
    }

    const zoomPercentage = formatNumberPrecision(scale * 100, 0)

    const { imageIndex, isout } = this.props
    console.log(isout, 'isout')
    const normal = (
      <React.Fragment>
        <div className="bottom-left overlay-element">
          {posx >= 0 && posy >= 0 && !isout && <div>X: {posx}</div>}
          {posx >= 0 && posy >= 0 && !isout && <div>Y: {posy}</div>}
          <div>Z: {imageIndex}</div>
          <div>Zoom: {zoomPercentage}%</div>
        </div>
      </React.Fragment>
    )

    return <div className="ViewportOverlay">{normal}</div>
  }
}

export default ViewportOverlay
