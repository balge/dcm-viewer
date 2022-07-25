import formatPN from './formatPN'
import formatDA from './formatDA'
import formatTM from './formatTM'
import formatNumberPrecision from './formatNumberPrecision'
import isValidNumber from './isValidNumber'
import TaskQueue from './requestLimit'

const RandomNum = (max, min) => {
  return Math.floor(Math.random() * (max - min + 1) + min) * 1000
}

const helpers = {
  formatPN,
  formatDA,
  formatTM,
  formatNumberPrecision,
  isValidNumber,
  TaskQueue,
  RandomNum,
}

export { helpers }
