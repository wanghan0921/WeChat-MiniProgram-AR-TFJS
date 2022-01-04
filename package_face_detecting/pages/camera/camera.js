const face = require('../../utils/faceBusiness.js')
const canvasId = 'canvas1';
const speedMaxCount = 6;
const isReserveDraw = false;
const isWithFaceLandmarks = true;
// camera listener
var listener = null;

const EMOTION = {
    'neutral': '平常 😐',
    'surprised': '吃惊 😮',
    'disgusted': '恶心 🤮',
    'fearful': '害怕 😨',
    'sad': '伤心 🙁',
    'angry': '生气 😠',
    'happy': '开心 😃',
}

Page({
    data: {
        devicePosition: 'front',
        cameraStyle: 'camera_Android',
        expressions: '评估中...',
        mouthStatus: '评估中...',
        system: ''
    },
    onReady() {
        var _that = this;
        // set cameraStyle of camera by system platform
        wx.getSystemInfo({
            success(res) {
                console.log(res);
                const system = res.system.split(' ')[1]
                if (res.system.indexOf('iOS') !== -1) {
                    _that.setData({
                        cameraStyle: 'camera_iOS',
                        
                    });
                    _that.data.system = system
                }
            }
        })
    },
    async onLoad() {
        var _that = this;
        wx.showLoading({
            title: 'Loading...',
        });
        await face.loadmodel(canvasId, isReserveDraw);
        wx.hideLoading();
        wx.showLoading({
            title: 'Warming Up...',
        });
        await face.warmup();
        wx.hideLoading();
        _that.startTacking();
    },
    onUnload: function () {
        this.stopTacking();
        console.log('onUnload', 'listener is stop');
    },

    showExpression({ expressions }) {
        const arr = Object.entries(expressions);
        const max = arr.reduce((acc, current) => {
            return acc[1] > current[1] ? acc : current;
        }, [])
        this.setData({ expressions: EMOTION[max[0]] })
        // emotion_result.textContent = EMOTION[max[0]];
    },


    point_point_dist(p1, p2) {
        var a = p1.x - p2.x;
        var b = p1.y - p2.y;
        return Math.sqrt(a * a + b * b);
    },
    showMouthStatus({ landmarks }) {
        const {positions} = landmarks
        const mouth_distance_open = this.point_point_dist(positions[66], positions[62])
        if (mouth_distance_open < 13) {
            this.setData({ mouthStatus: '请开口朗读' })
        } else if (mouth_distance_open >= 13 && mouth_distance_open < 25) {
            this.setData({ mouthStatus: '正在开口朗读' })
        } else {
            this.setData({ mouthStatus: '正在热情朗读' })
        }
    },

    startTacking() {
        var _that = this;
        var count = 0;
        const context = wx.createCameraContext();

        if (!context.onCameraFrame) {
            var message = 'Does not support the new api "Camera.onCameraFrame".';
            console.log(message);
            wx.showToast({
                title: message,
                icon: 'none'
            });
            return;
        }

        // real-time
        listener = context.onCameraFrame(async function (res) {
            if (count < speedMaxCount) {
                count++;
                return;
            }
            count = 0;
            console.log('onCameraFrame:', res.width, res.height);
            const frame = {
                // data: new Uint8Array(res.data),
                data: res.data,
                width: res.width,
                height: res.height,
            };
            
            // process
            const { detectResults2, detectResults } = await face.detect(frame, isWithFaceLandmarks, frame.width, frame.height, null, _that.data.system);
            detectResults2[0] && _that.showExpression(detectResults2[0])
            detectResults[0] && _that.showMouthStatus(detectResults[0])


        });
        // start
        listener.start();
        console.log('startTacking', 'listener is start');
    },



    stopTacking() {
        if (listener) {
            listener.stop();
        }
    },
    changeDirection() {
        var status = this.data.devicePosition;
        if (status === 'back') {
            status = 'front';
        } else {
            status = 'back';
        }
        this.setData({
            devicePosition: status,
        });
    }
})
