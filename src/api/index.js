import axios from 'axios'

const instance = axios.create({
  headers: {
    'Content-Type': 'application/json',
  },
})

instance.interceptors.response.use(
  (res) => {
    return res
  },
  (error) => {
    return Promise.reject((error.response && error.response.data) || {})
  }
)

const api = {
  get(url, data, other = { headers: {} }) {
    return instance({
      method: 'get',
      baseURL: 'https://seeyourlung.com.cn',
      url: url,
      headers: {
        ...other.headers,
      },
      params: data,
    })
  },
  post(url, data, other = { headers: {} }) {
    return instance({
      method: 'post',
      baseURL: 'https://seeyourlung.com.cn',
      url: url,
      headers: {
        ...other.headers,
      },
      data,
    })
  },
}

export default api
