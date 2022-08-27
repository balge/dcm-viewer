import ReactDOM from 'react-dom'
import React from 'react'
import App from './containers/app'
import initCornerstone from './initCornerstone.js'
import './index.css'
import 'antd/dist/antd.css'
import { IntlProvider } from 'react-intl'
import en from './locales/en.json'
import zh from './locales/zh.json'
import Cookies from 'js-cookie'

const messages = {
  'en-us': en,
  'zh-cn': zh,
}

const lang = Cookies.get('lang') || 'en-us'

export default class Root extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      lang: lang,
    }
  }
  render() {
    const changeLang = (lang) => {
      if (lang === 'zh-cn') {
        this.setState({
          lang: 'en-us',
        })
        Cookies.set('lang', 'en-us')
      } else {
        this.setState({
          lang: 'zh-cn',
        })
        Cookies.set('lang', 'zh-cn')
      }
    }
    return (
      <IntlProvider
        locale={this.state.lang}
        messages={messages[this.state.lang]}
      >
        <div className="relative">
          <div
            className="text-sm cursor-pointer absolute left-1/2 top-10 flex"
            style={{ marginLeft: 520 }}
            onClick={() => changeLang(this.state.lang)}
          >
            <span
              className={
                this.state.lang === 'zh-cn' ? 'text-blue-500' : 'text-gray-500'
              }
            >
              中文
            </span>
            <span
              className={
                this.state.lang === 'en-us'
                  ? 'text-blue-500 ml-4'
                  : 'text-gray-500 ml-4'
              }
            >
              English
            </span>
          </div>
          <App locale={this.state.lang} />
        </div>
      </IntlProvider>
    )
  }
}

let root = document.createElement('div')
root.className = 'root'
document.body.appendChild(root)

initCornerstone()

ReactDOM.render(<Root />, root)
