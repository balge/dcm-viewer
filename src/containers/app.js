import React, { Component } from 'react'
import CornerstoneViewport from '~/components/index'
import { Slider, message, Form, InputNumber, Button, Steps, Modal } from 'antd'
import api from '../api'
import { helpers } from '../helpers'
import cornerstone from 'cornerstone-core'
import { FormattedMessage } from 'react-intl'
import { CloudUploadOutlined, SoundOutlined, QuestionCircleOutlined } from '@ant-design/icons'


const { Step } = Steps
const { TaskQueue, RandomNum } = helpers
let timer = null
let stepTimer = null

const ERROR_EN = {
  errorNpy: 'Calculation error. Please confirm files and data are correct',
  errorTimeout: 'The calculation timed out. Please recalculate',
  errorFailed: 'Calculation failed',
  errorOther: 'System maintenance',
  errorFile: 'The file is expired. Please upload it again.',
}
const ERROR_ZH = {
  errorNpy: '计算错误，请确认文件和数据是否正确',
  errorTimeout: '计算超时,请重新计算',
  errorFailed: '计算失败',
  errorOther: '系统维护中',
  errorFile: '文件过期，请重新上传',
}

export default class App extends Component {
  // 1左键，2右键， 4中间滚轮click
  state = {
    showDialog: false,
    currStep: null,
    recalculate: false,
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
    const { locale } = this.props
    const ERRORS = {
      400: locale === 'zh-ch' ? ERROR_ZH.errorFailed : ERROR_EN.errorFailed,
      401: locale === 'zh-ch' ? ERROR_ZH.errorStop : ERROR_EN.errorStop,
      402: locale === 'zh-ch' ? ERROR_ZH.errorDoing : ERROR_EN.errorDoing,
      403: locale === 'zh-ch' ? ERROR_ZH.errorNpy : ERROR_EN.errorNpy,
      404: locale === 'zh-ch' ? ERROR_ZH.errorTimeout : ERROR_EN.errorTimeout,
      405: locale === 'zh-ch' ? ERROR_ZH.errorFile : ERROR_EN.errorFile,
      406: locale === 'zh-ch' ? ERROR_ZH.errorOther : ERROR_EN.errorOther,
    }

    const onFinish = (values) => {
      //说明有结果，计算都是下一步
      if (
        this.state.currStep === 1 &&
        this.state.tasks.task1 &&
        this.state.tasks.task2 &&
        !this.state.recalculate
      ) {
        this.setState({
          calcLoading: true,
        })
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
        this.state.tasks.task3 &&
        !this.state.recalculate
      ) {
        this.setState({
          calcLoading: true,
        })
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
                recalculate: false,
              })
              clearTimeout(stepTimer)
              clearTimeout(timer)
            }
          })
          .catch((err) => {
            this.setState({
              calcLoading: false,
              recalculate: false,
            })
            clearTimeout(stepTimer)
            clearTimeout(timer)
            message.error(ERRORS[406])
          })
        this.setState({
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
          recalculate: false,
          stopParam: params,
          currStep: 0,
          calcLoading: true,
        })
        timer = setInterval(() => {
          waitFnc(params)
            .then((res) => {
              if (res.data.code.toString().indexOf('20') !== -1) {
                clearInterval(timer)
                this.setState({
                  calcLoading: false,
                  currStep: 1,
                  tasks: {
                    task1: res.data.data.data.task_1,
                    task2: res.data.data.data.task_2,
                    task3: res.data.data.data.task_3,
                  },
                  renderTasks: {
                    task1: res.data.data.data.task_1,
                  },
                })
              } else {
                if (res.data.code !== 0) {
                  message.error(ERRORS[res.data.code])
                  onCancel()
                }
              }
            })
            .catch((err) => {
              message.error(ERRORS[406])
            })
        }, 2000)
      }
    }

    //输入框变动后，重新开始计算
    //记录下状态，是否重新计算
    const onValuesChange = (changedValues, allValues) => {
      if (
        this.state.stopParam.x === allValues.posx &&
        this.state.stopParam.y === allValues.posy &&
        this.state.stopParam.z === allValues.posz
      ) {
        this.setState({
          recalculate: false,
        })
      } else {
        this.setState({
          recalculate: true,
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
        (it) => !it.name.startsWith('.')
      )
      const timestamp = Math.floor(new Date().getTime() / 1000).toString()
      const len = files.length
      if (!len) return
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
                    `wadouri:https://seeyourlung.com.cn${res.data.data.img[0].url}`,
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
          urls.push(`wadouri:https://seeyourlung.com.cn${item.img[0].url}`)
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

    return (
      <div className="mx-auto py-6 reletive" style={{ width: 1200 }}>
        <header className="bg-white mb-4">
          <h1 className="text-4xl font-bold leading-tight text-gray-900 text-center mb-6">
            <FormattedMessage id="title"></FormattedMessage>
          </h1>
        </header>
        <main className="w-full mx-auto grid grid-cols-2 gap-10 px-4">
          <div>
            <div className="p-6">
              <div className="w-full flex justify-start items-center">
                <div className="relative">
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
                    onClick={(e) => {
                      e.target.value = ""
                    }}
                  />
                </div>
                <div className='w-5 ml-4 text-lg cursor-pointer' onClick={() => this.setState({
                  showDialog: true
                })}>
                  <QuestionCircleOutlined />
                </div>
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
                      tooltipVisible={false}
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
                <div className="w-full mt-4 bg-gray-400 bg-opacity-10 rounded-xl py-52 text-center relative">
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
                onValuesChange={onValuesChange}
                autoComplete="off"
                className="flex justify-between items-start"
              >
                <Form.Item
                  label={<FormattedMessage id="x"></FormattedMessage>}
                  name="posx"
                  rules={[
                    {
                      required: true,
                      message: '',
                    },
                  ]}
                >
                  <InputNumber style={{ width: 90 }} min={0} max={510} />
                </Form.Item>
                <Form.Item
                  label={<FormattedMessage id="y"></FormattedMessage>}
                  name="posy"
                  rules={[
                    {
                      required: true,
                      message: '',
                    },
                  ]}
                >
                  <InputNumber style={{ width: 90 }} min={0} max={510} />
                </Form.Item>
                <Form.Item
                  label={<FormattedMessage id="z"></FormattedMessage>}
                  name="posz"
                  rules={[
                    {
                      required: true,
                      message: '',
                    },
                  ]}
                >
                  <InputNumber
                    style={{ width: 90 }}
                    min={1}
                    max={this.state.fileLen}
                  />
                </Form.Item>
                <div className="w-full mt-6">
                  <Form.Item>
                    {this.state.calcLoading ? (
                      <Button
                        size="large"
                        type="primary"
                        block
                        onClick={() => onCancel()}
                      >
                        <FormattedMessage id="buttonStop"></FormattedMessage>
                      </Button>
                    ) : (
                      <Button
                        size="large"
                        type="primary"
                        block
                        htmlType="submit"
                        disabled={!this.state.imageIds.length}
                      >
                        {
                          this.state.currStep === 1 ? <FormattedMessage id="buttonStart2"></FormattedMessage> : this.state.currStep === 2 ? <FormattedMessage id="buttonStart3"></FormattedMessage> : <FormattedMessage id="buttonStart1"></FormattedMessage>
                        }
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
                    subTitle={<FormattedMessage id="stepV1"></FormattedMessage>}
                    description={
                      this.state.renderTasks.task1 ? (
                        <FormattedMessage
                          id="result1"
                          values={{
                            value: (this.state.renderTasks.task1 * 100).toFixed(
                              2
                            ),
                          }}
                        ></FormattedMessage>
                      ) : (
                        ''
                      )
                    }
                  />
                  {this.state.tasks.task2 ? (
                    <Step
                      disabled
                      title={<FormattedMessage id="step2"></FormattedMessage>}
                      subTitle={
                        <FormattedMessage id="stepV2"></FormattedMessage>
                      }
                      description={
                        this.state.renderTasks.task2 ? (
                          <FormattedMessage
                            id="result2"
                            values={{
                              value: (
                                this.state.renderTasks.task2 * 100
                              ).toFixed(2),
                            }}
                          ></FormattedMessage>
                        ) : (
                          ''
                        )
                      }
                    />
                  ) : (
                    <Step
                      status="wait"
                      disabled
                      title={<FormattedMessage id="step2"></FormattedMessage>}
                      subTitle={
                        <FormattedMessage id="stepV2"></FormattedMessage>
                      }
                      description={
                        this.state.renderTasks.task2 ? (
                          <FormattedMessage
                            id="result2"
                            values={{
                              value: (
                                this.state.renderTasks.task2 * 100
                              ).toFixed(2),
                            }}
                          ></FormattedMessage>
                        ) : (
                          ''
                        )
                      }
                    />
                  )}
                  {this.state.tasks.task3 ? (
                    <Step
                      disabled
                      title={<FormattedMessage id="step3"></FormattedMessage>}
                      description={
                        this.state.renderTasks.task3 ? (
                          <FormattedMessage
                            id="result3"
                            values={{
                              valueHigh: (
                                this.state.renderTasks.task3[0] * 100
                              ).toFixed(2),
                              valueMid: (
                                this.state.renderTasks.task3[1] * 100
                              ).toFixed(2),
                              valueLow: (
                                this.state.renderTasks.task3[2] * 100
                              ).toFixed(2),
                            }}
                          ></FormattedMessage>
                        ) : (
                          ''
                        )
                      }
                    />
                  ) : (
                    <Step
                      status="wait"
                      disabled
                      title={<FormattedMessage id="step3"></FormattedMessage>}
                      description={
                        this.state.renderTasks.task3 ? (
                          <FormattedMessage
                            id="result3"
                            values={{
                              valueHigh: (
                                this.state.renderTasks.task3[0] * 100
                              ).toFixed(2),
                              valueMid: (
                                this.state.renderTasks.task3[1] * 100
                              ).toFixed(2),
                              valueLow: (
                                this.state.renderTasks.task3[2] * 100
                              ).toFixed(2),
                            }}
                          ></FormattedMessage>
                        ) : (
                          ''
                        )
                      }
                    />
                  )}
                </Steps>
              </div>
              <div className="mt-6">
                <div className="text-lg text-black text-opacity-80 mb-4 flex justify-start items-center">
                  <SoundOutlined />
                  <div className="ml-2">Note</div>
                </div>
                <div className="text-base text-black text-opacity-70 mb-3">
                  <FormattedMessage id="noteT1"></FormattedMessage>
                </div>
                <div className="text-base text-black text-opacity-70 mb-3">
                  <FormattedMessage id="noteT2"></FormattedMessage>
                  <ul className="mt-2 list-disc pl-3">
                    <li className="text-sm text-opacity-50 mb-2">
                      <FormattedMessage id="noteT2Text1"></FormattedMessage>
                    </li>
                    <li className="text-sm text-opacity-50 mb-2">
                      <FormattedMessage id="noteT2Text2"></FormattedMessage>
                    </li>
                    <li className="text-sm text-opacity-50 mb-2">
                      <FormattedMessage id="noteT2Text3"></FormattedMessage>
                    </li>
                  </ul>
                </div>
                <div>
                  <Button><a target="_blank" href={locale === 'en-us' ? 'https://seeyourlung.com.cn/upload/manual/English_manual.pdf' : 'https://seeyourlung.com.cn/upload/manual/Chinese_manual.pdf'}>
                    <FormattedMessage id="help"></FormattedMessage>
                  </a></Button>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Modal width={620} title={locale === 'en-us' ? 'Privacy Statement' : '隐私声明'} visible={this.state.showDialog} onOk={() => this.setState({
          showDialog: false
        })} onCancel={() => this.setState({
          showDialog: false
        })} footer={[
          <Button onClick={() => this.setState({
            showDialog: false
          })}>
            <FormattedMessage id="dialog"></FormattedMessage>
          </Button>
        ]}>
          {
            locale === 'en-us' ? <div>
              <div>说明英文1</div>
              <div>说明英文2</div>
              <div>说明英文3</div>
              <div>说明英文4</div>
            </div> : <div>
              <div>说明中文1</div>
              <div>说明中文2</div>
              <div>说明中文3</div>
              <div>说明中文4</div>
            </div>
          }
        </Modal>
        <div className="text-gray-400 text-sm text-center py-6 mt-4">
          <div className="mb-6">
            <FormattedMessage id="tips"></FormattedMessage>
          </div>
          <a
            className="text-gray-400"
            href="http://beian.miit.gov.cn/"
            target="_blank"
          >
            京ICP备2022019826号-1
          </a>
        </div>
      </div>
    )
  }
}
