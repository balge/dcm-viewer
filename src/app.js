import React from 'react'
import ReactDOM from 'react-dom'
import App from './containers/app'
import initCornerstone from './initCornerstone.js'
import './index.css'
import 'antd/dist/antd.css';
import {IntlProvider} from 'react-intl';
import en from './locales/en.json';
import zh from './locales/zh.json';
import Cookies from 'js-cookie'

const messages = {
    'en-us': en,
    'zh-cn': zh
}
const locale = Cookies.get('lang') || 'zh-cn';

initCornerstone()
ReactDOM.render(<IntlProvider locale={locale} messages={messages[locale]}><App /></IntlProvider>, document.getElementById('app'))
