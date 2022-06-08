import React, { Component } from 'react'
import CornerstoneViewport from '~/components/index'
import { Slider, message, Form, Input, Button } from 'antd'
import api from '../api'
import { helpers } from '../helpers'

const { TaskQueue } = helpers

export default class App extends Component {
  // 1左键，2右键， 4中间滚轮click
  state = {
    precent: 0,
    fileLen: 0,
    paths: {
      path: '',
      path_name: '',
    },
    //canves渲染的图片
    imageIds: [
      // 'wadouri://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.11.dcm',
      // 'wadouri://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.12.dcm',
      // 'wadouri://121.196.101.101/upload/SE3/IM1.DCM',
    ],
    uploading: false,
    calcLoading: false,
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
      const params = {
        x: values.posx,
        y: values.posy,
        z: values.posz,
        path: this.state.paths.path,
        path_name: this.state.paths.path_name,
      }
      api.post('/api/demo/calculate', params).then((res) => {
        message.info(res.data.data.msg)
      })
      this.setState({
        message: '',
        calcLoading: true,
      })
      const timer = setInterval(() => {
        waitFnc(params).then((res) => {
          if (res.data.code === 200) {
            clearInterval(timer)
            this.setState({
              calcLoading: false,
              message: res.data.data.msg,
            })
          }
        })
      }, 2000)
    }

    const waitFnc = (params) => {
      return api.post('/api/demo/waiting', params)
    }

    const onChange = (e) => {
      console.log(e.target.files, 'files')
      const timestamp = Math.floor(new Date().getTime() / 1000).toString()
      const len = e.target.files.length
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
        formData.append('files[]', e.target.files[i])
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
                var xhr = new XMLHttpRequest()
                xhr.open(
                  'GET',
                  `http://121.196.101.101:80${res.data.data.img[0].url}`
                )
                xhr.send('')
                return resolve(res.data.data)
              })
            )
        )
      }
      new TaskQueue(tasks, 20, 2, (r) => {
        r.sort((a, b) => a.index - b.index)
        const urls = []
        r.forEach((item) => {
          urls.push(`wadouri://121.196.101.101:80${item.img[0].url}`)
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
      <div className="w-full">
        <header className="bg-white mb-4">
          <div className="px-4 py-6">
            <h1 className="text-3xl font-bold leading-tight text-gray-900">
              肺结节良恶性诊断
              <span className="block">V1.0</span>
            </h1>
          </div>
        </header>
        <main className="w-full min-w-[1000px] mx-auto grid grid-cols-2 gap-10 px-4">
          <div className="rounded border border-solid border-gray-100">
            <div className="px-4 py-2 text-base text-black text-opacity-80 bg-gray-50">
              基本内容
            </div>
            <div className="px-4 py-2">
              <div className="relative w-full">
                <Button
                  type="primary"
                  size="large"
                  loading={this.state.uploading}
                >
                  {this.state.uploading
                    ? `${this.state.fileLen}张图片上传`
                    : '选择图片'}
                </Button>
                <input
                  className="opacity-0 absolute left-0 top-0  bottom-0 right-0 z-10"
                  type="file"
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
                <div className="w-full mt-4">
                  {this.state.uploading ? '图像加载中...' : '请选择DCM图像'}
                </div>
              )}
            </div>
          </div>
          <div className="rounded border border-solid border-gray-100">
            <div className="px-4 py-2 text-base text-black text-opacity-80 bg-gray-50">
              操作
            </div>
            <div className="px-4 py-2">
              <Form
                name="pos"
                labelCol={{
                  span: 4,
                }}
                wrapperCol={{
                  span: 20,
                }}
                initialValues={{
                  remember: true,
                }}
                onFinish={onFinish}
                autoComplete="off"
              >
                <Form.Item
                  label="x轴"
                  name="posx"
                  rules={[
                    {
                      required: true,
                      message: '请输入x轴坐标',
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="y轴"
                  name="posy"
                  rules={[
                    {
                      required: true,
                      message: '请输入y轴坐标',
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  label="z轴"
                  name="posz"
                  rules={[
                    {
                      required: true,
                      message: '请输入z轴坐标',
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item
                  wrapperCol={{
                    offset: 4,
                    span: 20,
                  }}
                >
                  <Button
                    size="large"
                    type="primary"
                    htmlType="submit"
                    disabled={!this.state.imageIds.length}
                    loading={this.state.calcLoading}
                  >
                    计算
                  </Button>
                  <div className="text-sm text-center text-black mt-3">
                    {this.state.message}
                  </div>
                </Form.Item>
              </Form>
            </div>
          </div>
        </main>
      </div>
    )
  }
}
