// package_recoder_detecting/pages/recorder/recorder.js
import CryptoJS from 'crypto-js'
import { weBtoa, weAtob } from '../../utils/decode'

const APPID = '46ee41d6'
const API_SECRET = 'Y2NiYWU5ODRiMjg2YWIxNzE2MjdlNWU2'
const API_KEY = '6250d5ec719eb6e698f4fa81efd896de'
const language = 'zh_cn'
const accent = 'mandarin'


Page({

  /**
   * 页面的初始数据
   */
  data: {
    recorderOptions: {
      duration: 60000, //录音的时长，单位 ms，600000是最大值 
      sampleRate: 16000, // 采样率（pc不支持）
      numberOfChannels: 1, //录音通道
      format: 'PCM', // 音频格式
      frameSize: 1
    },
    recordingTime: 0, // 录音时长
    isRecording: false,
    frameBuffer: [],
    isLastFrame: false,
    isFristFrame: true,
    resultText: '',
    resultTextTemp: ''
  },
  recorderManager: undefined,
  SocketTask: undefined,
  handlerInterval: undefined,
  connect: false,
  recordingTimer: 0, // 录音计时定时器


  onLoad() {
    this.recorderManager = wx.getRecorderManager()
  },

  onUnload() {
    this.recorderManager.stop()
    this.SocketTask.close()
  },

  onHide() {
    this.recorderManager.stop()
    this.SocketTask.close()
  },

  _startRecord: function () {
    wx.showLoading({
      title: '正在开启录音',
      mask: true
    })
    this.recorderManager.onStart(() => {
      console.log('recorder start')
      // this._connectWS()
      wx.hideLoading()
      this.recordingTimer = setInterval(() => {
        this.setData({ recordingTime: ++this.data.recordingTime })
      }, 1000)
      this.setData({ isRecording: true })

    })

    // 录音结束
    this.recorderManager.onStop((res) => {
      const { tempFilePath, duration, fileSize } = res
      this.SocketTask.close()
      this.setData({isRecording: false, recordingTime: 0})
      clearInterval(this.recordingTimer)
    })

    // 录音错误埋点
    this.recorderManager.onError(err => {
      const { errMsg } = err
      console.log(errMsg)
    })

    this.recorderManager.onFrameRecorded(res => {
      const { frameBuffer, isLastFrame } = res
      this.data.isLastFrame = isLastFrame
      this.data.frameBuffer = frameBuffer
      this.sendSocketMessage()
    })

    this.recorderManager.start(this.data.recorderOptions)
  },

  toBase64(buffer) {
    var binary = ''
    var bytes = new Uint8Array(buffer)
    var len = bytes.byteLength
    for (var i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return weBtoa(binary)
  },

  sendSocketMessage() {
    // websocket未连接
    if (!this.connect) {
      clearInterval(this.handlerInterval)
      return
    }
    if (this.data.isFristFrame) {
      this.data.isFristFrame = false
      const data = {
        common: {
          app_id: APPID,
        },
        business: {
          language, //小语种可在控制台--语音听写（流式）--方言/语种处添加试用
          domain: 'iat',
          accent, //中文方言可在控制台--语音听写（流式）--方言/语种处添加试用
          vad_eos: 5000,
          dwa: 'wpgs', //为使该功能生效，需到控制台开通动态修正功能（该功能免费）
        },
        data: {
          status: 0,
          format: 'audio/L16;rate=16000',
          encoding: 'raw',
          audio: this.toBase64(this.data.frameBuffer),
        },
      }
      this.SocketTask.send({
        data: JSON.stringify(data)
      })
    }
    const data = {
      status: this.data.isLastFrame ? 2 : 1,
      format: 'audio/L16;rate=16000',
      encoding: 'raw',
      audio: this.toBase64(this.data.frameBuffer),
    }
    if (this.data.isLastFrame) {
      this.SocketTask.send(
        { data: JSON.stringify({ data }) }
      )
    }
    // 中间帧
    this.SocketTask.send(
      { data: JSON.stringify({ data }) }
    )
  },

  async _connectWS() {
    const url = await this.getWebSocketUrl()
    this.SocketTask = wx.connectSocket({
      url,
      header: {
        'content-type': 'application/json'
      },
      success: () => {
        console.log('wx success')
        this.connect = true
      },
      fail: err => {
        console.log(err)
      }
    })

    this.SocketTask.onClose(() => {
      console.log('ws onClose')
      wx.showToast({
        title: 'ws close',
        icon: 'none'
      })
      this.connect = false
      this.recorderManager.stop()
    })

    wx.onSocketOpen(res => {
      console.log(res)
    })

    this.SocketTask.onOpen(res => {
      console.log('ws isRead')
      this._startRecord()
    })

    this.SocketTask.onError(res => {
      console.log('ws onError', res)
      // this._startRecord()
    })

    this.SocketTask.onMessage(res => {
      console.log(res.data)
      this.result(res.data)
    })
  },

  result(resultData) {
    // 识别结束
    let jsonData = JSON.parse(resultData)
    if (jsonData.data && jsonData.data.result) {
      let data = jsonData.data.result
      let str = ''
      let resultStr = ''
      let ws = data.ws
      for (let i = 0; i < ws.length; i++) {
        str = str + ws[i].cw[0].w
      }
      // 开启wpgs会有此字段(前提：在控制台开通动态修正功能)
      // 取值为 "apd"时表示该片结果是追加到前面的最终结果；取值为"rpl" 时表示替换前面的部分结果，替换范围为rg字段
      if (data.pgs) {
        if (data.pgs === 'apd') {
          // 将resultTextTemp同步给resultText
          this.setData({
            resultText: this.data.resultTextTemp,
          })
        }
        // 将结果存储在resultTextTemp中
        this.setData({
          resultTextTemp: this.data.resultText + str,
        })
      } else {
        this.setData({
          resultText: this.data.resultText + str,
        })
      }
    }
    if (jsonData.code === 0 && jsonData.data.status === 2) {
      this.SocketTask.close()
    }
    if (jsonData.code !== 0) {
      this.SocketTask.close()
      console.log(`${jsonData.code}:${jsonData.message}`)
    }
  },


  getWebSocketUrl() {
    return new Promise((resolve, reject) => {
      // 请求地址根据语种不同变化
      var url = 'wss://iat-api.xfyun.cn/v2/iat'
      var host = 'iat-api.xfyun.cn'
      var apiKey = API_KEY
      var apiSecret = API_SECRET
      var date = new Date().toGMTString()
      var algorithm = 'hmac-sha256'
      var headers = 'host date request-line'
      var signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/iat HTTP/1.1`
      var signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret)
      var signature = CryptoJS.enc.Base64.stringify(signatureSha)
      var authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`
      var authorization = weBtoa(authorizationOrigin)
      url = encodeURI(`${url}?authorization=${authorization}&date=${date}&host=${host}`)
      resolve(url)
    })
  }
})