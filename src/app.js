import React from 'react'
import ReactDOM from 'react-dom'
import App from './containers/app'
import initCornerstone from './initCornerstone.js'
import './index.css'
import 'antd/dist/antd.css';

initCornerstone()
ReactDOM.render(<App />, document.getElementById('app'))
