import React, { Component } from 'react'
import CornerstoneViewport from '~/components/index'
import { Slider, message, Form, InputNumber, Button, Steps } from 'antd'
import api from '../api'
import { helpers } from '../helpers'
import cornerstone from 'cornerstone-core'
import { FormattedMessage } from 'react-intl'
import { CloudUploadOutlined } from '@ant-design/icons'
import Cookies from 'js-cookie'

const { Step } = Steps
const { TaskQueue, RandomNum } = helpers
let timer = null
let stepTimer = null

const ERROR_EN = {
  errorNpy: 'Npy file was not generated successfully. Please recalculate',
  errorTimeout: 'Timeout, please recalculate',
  errorDoing: 'Calculating',
  errorStop: 'Calculation stop',
  errorFailed: 'Calculation failed',
}
const ERROR_ZH = {
  errorNpy: 'npy文件未生成成功请重新计算',
  errorTimeout: '超时,请重新计算',
  errorDoing: '计算中',
  errorStop: '计算停止',
  errorFailed: '计算失败',
}

const locale = Cookies.get('lang') || 'zh-cn'
console.log(locale, 'locale')

const ERRORS = {
  400: locale === 'zh-ch' ? ERROR_ZH.errorFailed : ERROR_EN.errorFailed,
  401: locale === 'zh-ch' ? ERROR_ZH.errorStop : ERROR_EN.errorStop,
  402: locale === 'zh-ch' ? ERROR_ZH.errorDoing : ERROR_EN.errorDoing,
  403: locale === 'zh-ch' ? ERROR_ZH.errorNpy : ERROR_EN.errorNpy,
  404: locale === 'zh-ch' ? ERROR_ZH.errorTimeout : ERROR_EN.errorTimeout,
}

export default class App extends Component {
  // 1左键，2右键， 4中间滚轮click
  state = {
    currStep: null,
    precent: 0,
    fileLen: 0,
    paths: {
      path: '',
      path_name: '',
    },
    stopParam: {},
    //canves渲染的图片
    imageIds: [],
    uploading: false,
    calcLoading: false,
    tasks: {
      task1: '',
      task2: '',
      task3: '',
    },
    renderTasks: {
      task1: '',
      task2: '',
      task3: '',
    },
    imageIdIndex: 0,
    tools: [
      // Mouse
      {
        name: 'Zoom',
        mode: 'active',
        modeOptions: { mouseButtonMask: 2 },
      },
      {
        name: 'Pan',
        mode: 'active',
        modeOptions: { mouseButtonMask: 1 },
      },
      // Scroll
      { name: 'ZoomMouseWheel', mode: 'active' },
      // Touch
      { name: 'PanMultiTouch', mode: 'active' },
      { name: 'ZoomTouchPinch', mode: 'active' },
      // { name: 'StackScrollMultiTouch', mode: 'active' },
    ],
  }
  render() {
    const onFinish = (values) => {
      this.setState({
        calcLoading: true,
      })
      //说明有结果，计算都是下一步
      if (
        this.state.currStep === 1 &&
        this.state.tasks.task1 &&
        this.state.tasks.task2
      ) {
        stepTimer = setTimeout(() => {
          this.setState({
            seconds: 0,
            renderTasks: {
              task1: this.state.tasks.task1,
              task2: this.state.tasks.task2,
            },
            currStep: 2,
            calcLoading: false,
          })
        }, RandomNum(3, 7))
      } else if (
        this.state.currStep === 2 &&
        this.state.tasks.task1 &&
        this.state.tasks.task2 &&
        this.state.tasks.task3
      ) {
        stepTimer = setTimeout(() => {
          this.setState({
            seconds: 0,
            renderTasks: {
              task1: this.state.tasks.task1,
              task2: this.state.tasks.task2,
              task3: this.state.tasks.task3,
            },
            currStep: 3,
            calcLoading: false,
          })
        }, RandomNum(3, 7))
      } else {
        // 其他情况重新发起计算
        const params = {
          x: values.posx,
          y: values.posy,
          z: values.posz,
          path: this.state.paths.path,
          path_name: this.state.paths.path_name,
        }
        api
          .post('/api/demo/calculate', params)
          .then((res) => {
            if (res.data.code.toString().indexOf('20') === -1) {
              message.error(ERRORS[res.data.code])
              this.setState({
                calcLoading: false,
              })
            } else {
              this.setState({
                tasks: {
                  task1: '',
                  task2: '',
                  task3: '',
                },
                stopParam: params,
                currStep: 0,
              })
              timer = setInterval(() => {
                waitFnc(params)
                  .then((res) => {
                    if (res.data.code.indexOf('20') !== -1) {
                      clearInterval(timer)
                      this.setState({
                        calcLoading: false,
                        currStep: 1,
                        tasks: {
                          task1: res.data.data.task01,
                          task2: res.data.data.task02,
                          task3: res.data.data.task03,
                        },
                        renderTasks: {
                          task1: res.data.data.task01,
                        },
                      })
                    } else {
                    }
                  })
                  .catch((err) => {
                    message.error(ERRORS[400])
                  })
              }, 2000)
            }
          })
          .catch((err) => {
            this.setState({
              calcLoading: false,
            })
            message.error(ERRORS[400])
          })
      }
    }

    const onCancel = () => {
      setTimeout(() => {
        this.setState({
          calcLoading: false,
        })
      }, 5)
      if (this.state.currStep >= 1) {
        clearTimeout(stepTimer)
      } else {
        api.post('/api/demo/stop', {
          ...this.state.stopParam,
        })
        clearInterval(timer)
      }
    }

    const waitFnc = (params) => {
      return api.post('/api/demo/waiting', params)
    }

    const onChange = (e) => {
      console.log(e.target.files, 'files')
      const files = Object.values(e.target.files).filter(
        (it) => it.name.indexOf('.dcm') !== -1 || it.name.indexOf('.DCM') !== -1
      )
      const timestamp = Math.floor(new Date().getTime() / 1000).toString()
      const len = files.length
      this.setState({
        uploading: true,
        imageIdIndex: 0,
        fileLen: len,
        precent: 1,
      })
      let tasks = []
      let count = 0
      for (let i = 0; i < len; i++) {
        let formData = new FormData()
        formData.append('files[]', files[i])
        formData.append('path', timestamp)
        formData.append('index', i)
        tasks.push(
          () =>
            new Promise((resolve, reject) =>
              api.post('/api/demo/upload', formData).then((res) => {
                count++
                this.setState({
                  precent: (count / len) * 100,
                })
                cornerstone
                  .loadAndCacheImage(
                    `wadouri://121.196.101.101:8090${res.data.data.img[0].url}`,
                    { addToBeginning: true, priority: -5 }
                  )
                  .then((image) => {
                    return resolve({
                      ...res.data.data,
                      index: image.data.string('x00200013'),
                    })
                  })
              })
            )
        )
      }
      new TaskQueue(tasks, 20, 2, (r) => {
        r.sort((a, b) => a.index - b.index)
        const urls = []
        r.forEach((item) => {
          urls.push(`wadouri://121.196.101.101:8090${item.img[0].url}`)
        })
        this.setState({
          imageIds: urls,
          uploading: false,
          paths: {
            path: r[0].path,
            path_name: r[0].path_name,
          },
        })
      })
    }

    const changeLang = () => {
      const lang = Cookies.get('lang')
      if (lang === 'zh-cn') {
        Cookies.set('lang', 'en-us')
      } else {
        Cookies.set('lang', 'zh-cn')
      }
      location.reload()
    }

    return (
      <div className="mx-auto py-6" style={{ width: 1200 }}>
        <header className="bg-white mb-4">
          <h1 className="text-4xl font-bold leading-tight text-gray-900 text-center mb-6">
            <FormattedMessage id="title"></FormattedMessage>
            <div
              className="float-right text-sm cursor-pointer text-gray-500"
              onClick={changeLang}
            >
              <FormattedMessage id="lang"></FormattedMessage>
            </div>
          </h1>
        </header>
        <main className="w-full mx-auto grid grid-cols-2 gap-10 px-4">
          <div>
            <div className="p-6">
              <div className="relative w-full">
                <Button
                  type="primary"
                  size="large"
                  loading={this.state.uploading}
                >
                  {this.state.uploading ? (
                    <span>
                      {this.state.fileLen}{' '}
                      <FormattedMessage id="uploadLoading"></FormattedMessage>
                    </span>
                  ) : (
                    <FormattedMessage id="uploadNormal"></FormattedMessage>
                  )}
                </Button>
                <input
                  className="opacity-0 absolute left-0 top-0  bottom-0 right-0 z-10"
                  type="file"
                  webkitdirectory="webkitdirectory"
                  multiple
                  onChange={onChange}
                />
              </div>
              {this.state.precent && this.state.uploading ? (
                <div className="w-full block mt-3 relative h-1 bg-gray-300">
                  <div
                    className="absolute left-0 top-0 bottom-0 bg-blue-400 transition-all"
                    style={{
                      width: `${this.state.precent}%`,
                    }}
                  ></div>
                </div>
              ) : (
                ''
              )}
              {this.state.imageIds.length ? (
                <div className="mt-4">
                  <CornerstoneViewport
                    tools={this.state.tools}
                    imageIds={this.state.imageIds}
                    imageIdIndex={this.state.imageIdIndex}
                    onElementEnabled={(elementEnabledEvt) => {
                      const cornerstoneElement =
                        elementEnabledEvt.detail.element
                      // Save this for later
                      this.setState({
                        cornerstoneElement,
                      })
                      // Wait for image to render, then invert it
                      cornerstoneElement.addEventListener(
                        'cornerstoneimagerendered',
                        (imageRenderedEvent) => {
                          const viewport = imageRenderedEvent.detail.viewport
                          const invertedViewport = Object.assign(
                            {},
                            {
                              ...viewport,
                              voi: {
                                windowWidth: 1500,
                                windowCenter: -400,
                              },
                            },
                            {
                              invert: false,
                            }
                          )

                          cornerstone.setViewport(
                            cornerstoneElement,
                            invertedViewport
                          )
                        }
                      )
                    }}
                    style={{
                      width: '100%',
                      height: '100%',
                      flex: '1',
                    }}
                  />
                  <div className="mt-4">
                    <Slider
                      min={0}
                      max={this.state.imageIds.length - 1}
                      value={this.state.imageIdIndex}
                      onChange={(val) =>
                        this.setState({
                          imageIdIndex: val,
                        })
                      }
                    />
                  </div>
                </div>
              ) : (
                <div className="w-full mt-4 bg-gray-400 bg-opacity-10 rounded-xl py-8 text-center relative">
                  <div className="text-gray-500 text-5xl">
                    <CloudUploadOutlined />
                  </div>
                  <div className="text-lg text-gray-500 mt-4">
                    {this.state.uploading ? (
                      <div>
                        <FormattedMessage id="gen"></FormattedMessage>
                      </div>
                    ) : (
                      <div>
                        <p>
                          <FormattedMessage id="uploadDrag"></FormattedMessage>
                        </p>
                        <Button type="primary" size="large">
                          <FormattedMessage id="uploadNormal"></FormattedMessage>
                        </Button>
                        <p className="text-base mt-2">
                          <FormattedMessage id="uploadInput"></FormattedMessage>
                        </p>
                      </div>
                    )}
                  </div>
                  {!this.state.uploading && (
                    <input
                      className="opacity-0 absolute left-0 top-0  bottom-0 right-0 z-10"
                      type="file"
                      webkitdirectory="webkitdirectory"
                      multiple
                      onChange={onChange}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <div className="p-6">
              <Form
                name="pos"
                layout="inline"
                onFinish={onFinish}
                autoComplete="off"
              >
                <Form.Item
                  label={<FormattedMessage id="x"></FormattedMessage>}
                  name="posx"
                  rules={[
                    {
                      required: true,
                    },
                  ]}
                >
                  <InputNumber style={{ width: 70 }} />
                </Form.Item>
                <Form.Item
                  label={<FormattedMessage id="y"></FormattedMessage>}
                  name="posy"
                  rules={[
                    {
                      required: true,
                    },
                  ]}
                >
                  <InputNumber style={{ width: 70 }} />
                </Form.Item>
                <Form.Item
                  label={<FormattedMessage id="z"></FormattedMessage>}
                  name="posz"
                  rules={[
                    {
                      required: true,
                    },
                  ]}
                >
                  <InputNumber style={{ width: 70 }} />
                </Form.Item>
                <div className="flex justify-center items-center w-full mt-6">
                  <Form.Item>
                    {this.state.calcLoading ? (
                      <Button
                        size="large"
                        type="primary"
                        onClick={() => onCancel()}
                      >
                        <FormattedMessage id="buttonStop"></FormattedMessage>
                      </Button>
                    ) : (
                      <Button
                        size="large"
                        type="primary"
                        htmlType="submit"
                        disabled={!this.state.imageIds.length}
                      >
                        <FormattedMessage id="buttonStart"></FormattedMessage>
                      </Button>
                    )}
                  </Form.Item>
                </div>
              </Form>
              <div className="mt-6">
                <Steps direction="vertical" current={this.state.currStep}>
                  <Step
                    disabled
                    title={<FormattedMessage id="step1"></FormattedMessage>}
                    description={this.state.renderTasks.task1}
                  />
                  <Step
                    disabled
                    title={<FormattedMessage id="step2"></FormattedMessage>}
                    description={this.state.renderTasks.task2}
                  />
                  <Step
                    disabled
                    title={<FormattedMessage id="step3"></FormattedMessage>}
                    description={this.state.renderTasks.task3}
                  />
                </Steps>
              </div>
            </div>
          </div>
        </main>
        <footer>
          <div className="text-gray-400 text-sm text-center mt-10">
            <FormattedMessage id="tips"></FormattedMessage>
          </div>
        </footer>
      </div>
    )
  }
}
