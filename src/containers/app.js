import React, { Component } from 'react'
import CornerstoneViewport from '../components/index'
import { Slider, Upload, message, Form, Input, Button } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
const { Dragger } = Upload

const props = {
  name: 'file',
  multiple: true,
  action: 'https://www.mocky.io/v2/5cc8019d300000980a055e76',

  onChange(info) {
    const { status } = info.file

    if (status !== 'uploading') {
      console.log(info.file, info.fileList)
    }

    if (status === 'done') {
      message.success(`${info.file.name} file uploaded successfully.`)
    } else if (status === 'error') {
      message.error(`${info.file.name} file upload failed.`)
    }
  },

  onDrop(e) {
    console.log('Dropped files', e.dataTransfer.files)
  },
}
const onFinish = (values) => {
  console.log('Success:', values)
}

const onFinishFailed = (errorInfo) => {
  console.log('Failed:', errorInfo)
}

export default class App extends Component {
  // 1左键，2右键， 4中间滚轮click
  state = {
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
    imageIds: [
      'wadouri://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.11.dcm',
      'wadouri://s3.amazonaws.com/lury/PTCTStudy/1.3.6.1.4.1.25403.52237031786.3872.20100510032220.12.dcm',
      'wadouri://121.196.101.101/upload/SE3/IM1.DCM',
    ],
  }
  render() {
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
              <Dragger {...props}>
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Click or drag file to this area to upload
                </p>
                <p className="ant-upload-hint">
                  Support for a single or bulk upload. Strictly prohibit from
                  uploading company data or other band files
                </p>
              </Dragger>
              {this.state.imageIds.length ? (
                <div className="mt-4">
                  <CornerstoneViewport
                    tools={this.state.tools}
                    imageIds={this.state.imageIds}
                    imageIdIndex={this.state.imageIdIndex}
                    style={{ maxWidth: '100%', height: '500px', flex: '1' }}
                  />
                  <div className=" mt-4">
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
                <div className="w-full text-center">请选择图片</div>
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
                onFinishFailed={onFinishFailed}
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
                  <Button size="large" type="primary" htmlType="submit">
                    计算
                  </Button>
                </Form.Item>
              </Form>
            </div>
          </div>
        </main>
      </div>
    )
  }
}
