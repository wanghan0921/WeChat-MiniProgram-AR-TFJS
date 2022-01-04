const faceapi = require('../../utils/face-api.js');
const jsfeat = require('../utils/jsfeat.js');
const fetchWechat = require('fetch-wechat');
// tiny_face_detector options
const inputSize = 288;
const scoreThreshold = 0.45;
const useTinyModel = true;
// your website url
// const modelUrlFaceDetector = 'https://github.com/justadudewhohacks/face-api.js/tree/master/weights/';
// const modelFaceExpressionModelUrl = 'cloud://636c-cloud1-9gn0fti4c708fb57-1307318900/models';
// const modelUrl = 'https://sanyuered.github.io/models/';
// decoration image for image tracker 
const decorationImageUrl = '../../../cat_beard.png';
// hidden canvas
const hiddenCanvasId = 'hiddenCanvas';
// canvas width
var canvasWidth = 0;
// canvas height
var canvasHeight = 0;
// a canvas
var canvas1;
// model config
var options;
// canvas id
var canvasId;
// if reserve draw
var isReserveDraw;
// temp photo path
var tempImagePath = null;

function createBrowserEnv() {
  return {
    Canvas: wx.createOffscreenCanvas(),
    CanvasRenderingContext2D: wx.createCanvasContext(canvasId),
    isReserveDraw: isReserveDraw,
    Image: null,
    ImageData: null,
    Video: null,
    createCanvasElement: function () {
      return {};
    },
    createImageElement: function () {
      return {};
    },
    fetch: fetchWechat.fetchFunc(),
    readFile: function () { }
  };
}

function getFaceDetectorOptions() {
  return new faceapi.TinyFaceDetectorOptions()
}

async function loadmodel(_canvasId,
  _isReserveDraw) {
  canvasId = _canvasId;
  isReserveDraw = _isReserveDraw;

  faceapi.setEnv(createBrowserEnv(canvasId, isReserveDraw));
  canvas1 = {
    width: 128,
    height: 128,
  };
  options = getFaceDetectorOptions();
  console.log('options', options);

  const result = await wx.cloud.getTempFileURL({
    fileList: [{ fileID: 'cloud://cloud1-9gn0fti4c708fb57.636c-cloud1-9gn0fti4c708fb57-1307318900/models/face_expression_model-shard1' }],
  })
  const { fileList } = result
  const url = fileList[0].tempFileURL.split('/models')[0] + '/models'
  await faceapi.loadFaceLandmarkTinyModel(url);
  await faceapi.loadFaceExpressionModel(url);
  await faceapi.loadTinyFaceDetectorModel(url);


  console.log('model is loaded.');
}

function getFrameSliceOptions(frameWidth, frameHeight, displayWidth, displayHeight) {
  let result = {
    start: [0, 0, 0],
    size: [-1, -1, 3]
  };

  const ratio = displayHeight / displayWidth;

  if (ratio > frameHeight / frameWidth) {
    result.start = [0, Math.ceil((frameWidth - Math.ceil(frameHeight / ratio)) / 2), 0];
    result.size = [-1, Math.ceil(frameHeight / ratio), 3];
  } else {
    result.start = [Math.ceil((frameHeight - Math.floor(ratio * frameWidth)) / 2), 0, 0];
    result.size = [Math.ceil(ratio * frameWidth), -1, 3];
  }

  return result;
}

function versionStringCompare(preVersion = '', lastVersion = '') {
  var sources = preVersion.split('.');
  var dests = lastVersion.split('.');
  var maxL = Math.max(sources.length, dests.length);
  var result = 0;
  for (let i = 0; i < maxL; i++) {
    let preValue = sources.length > i ? sources[i] : 0;
    let preNum = isNaN(Number(preValue)) ? preValue.charCodeAt() : Number(preValue);
    let lastValue = dests.length > i ? dests[i] : 0;
    let lastNum = isNaN(Number(lastValue)) ? lastValue.charCodeAt() : Number(lastValue);
    if (preNum < lastNum) {
      result = -1;
      break;
    } else if (preNum > lastNum) {
      result = 1;
      break;
    }
  }
  return result;
}

async function detect(frame,
  isWithFaceLandmarks,
  _canvasWidth,
  _canvasHeight,
  photoPath,
  system) {
  canvasWidth = _canvasWidth;
  canvasHeight = _canvasHeight;
  tempImagePath = photoPath;
  var start = new Date();
  if (versionStringCompare(system, '14.5') === 1) {
    var tempTensor
    var inputImgElTensor = faceapi.tf.tidy(() => {
      const imgData = {
        data: new Uint8Array(frame.data),
        width: frame.width,
        height: frame.height
      }
      tempTensor = faceapi.tf.browser.fromPixels(imgData, 4)
      const sliceOptions = getFrameSliceOptions(frame.width, frame.height, canvas1.width, canvas1.height)
      return tempTensor.slice(sliceOptions.start, sliceOptions.size).resizeBilinear([canvas1.width, canvas1.height])
    })
  } else {
    var tempTensor = faceapi.tf.tensor(new Uint8Array(frame.data), [frame.height, frame.width, 4]);
    var inputImgElTensor = tempTensor.slice([0, 0, 0], [-1, -1, 3]);
  }

  var detectResults = [];
  var detectResults2 = [];
  if (isWithFaceLandmarks) {
    detectResults2 = await faceapi.detectAllFaces(inputImgElTensor, options).withFaceExpressions()
    detectResults = await faceapi.detectAllFaces(inputImgElTensor, options).withFaceLandmarks(useTinyModel)
  } else {
    detectResults = await faceapi.detectAllFaces(inputImgElTensor, options);
  }
  // memory management: dispose
  faceapi.tf.dispose(tempTensor);
  faceapi.tf.dispose(inputImgElTensor);
  // statistics
  var end1 = new Date();
  console.log("detect time", end1 - start, 'ms');
  console.log("detect result", detectResults, detectResults2);
  faceapi.matchDimensions(canvas1, frame);

  const resizedResults = faceapi.resizeResults(detectResults, frame);

  if (isWithFaceLandmarks) {
    faceapi.draw.drawFaceLandmarks(canvas1, resizedResults);

  }
  var end2 = new Date();
  console.log("draw time", end2 - end1, 'ms');

  return { detectResults, detectResults2 };
}

async function warmup() {
  // warm up model
  var frame = faceapi.tf.zeros([1, 1, 1, 3]);
  await faceapi.detectAllFaces(frame, options).withFaceLandmarks(useTinyModel);
  // memory management: dispose
  faceapi.tf.dispose(frame);
  console.log('warm up model');
}

var custom = {};

custom.perspective_transform = function (
  src_x0, src_y0, dst_x0, dst_y0,
  src_x1, src_y1, dst_x1, dst_y1,
  src_x2, src_y2, dst_x2, dst_y2,
  src_x3, src_y3, dst_x3, dst_y3) {
  var transform = new jsfeat.matrix_t(3, 3, jsfeat.F32_t | jsfeat.C1_t);
  jsfeat.math.perspective_4point_transform(transform,
    src_x0, src_y0, dst_x0, dst_y0,
    src_x1, src_y1, dst_x1, dst_y1,
    src_x2, src_y2, dst_x2, dst_y2,
    src_x3, src_y3, dst_x3, dst_y3);
  return transform;
};

custom.invert_transform = function (transform) {
  jsfeat.matmath.invert_3x3(transform, transform);
};

/*
Reference: https://github.com/josundin/magcut/blob/master/js/imagewarp.js
Author: josundin
Title: image warp
License: MIT
*/
custom.warp_perspective_color = function (src, dst, transform) {
  var dst_width = dst.width | 0, dst_height = dst.height | 0;
  var src_width = src.width | 0, src_height = src.height | 0;
  var x = 0, y = 0, off = 0, ixs = 0, iys = 0, xs = 0.0, ys = 0.0, xs0 = 0.0, ys0 = 0.0, ws = 0.0, sc = 0.0, a = 0.0, b = 0.0, p0r = 0.0, p1r = 0.0, p0g = 0.0, p1g = 0.0, p0b = 0.0, p1b = 0.0;
  var td = transform;
  var m00 = td[0], m01 = td[1], m02 = td[2],
    m10 = td[3], m11 = td[4], m12 = td[5],
    m20 = td[6], m21 = td[7], m22 = td[8];
  var dptr = 0;
  for (var i = 0; i < dst_height; ++i) {
    xs0 = m01 * i + m02,
      ys0 = m11 * i + m12,
      ws = m21 * i + m22;
    for (var j = 0; j < dst_width; j++, dptr += 4, xs0 += m00, ys0 += m10, ws += m20) {
      sc = 1.0 / ws;
      xs = xs0 * sc, ys = ys0 * sc;
      ixs = xs | 0, iys = ys | 0;
      if (xs > 0 && ys > 0 && ixs < (src_width - 1) && iys < (src_height - 1)) {
        a = Math.max(xs - ixs, 0.0);
        b = Math.max(ys - iys, 0.0);
        //off = (src_width*iys + ixs)|0;
        off = (((src.width * 4) * iys) + (ixs * 4)) | 0;
        p0r = src.data[off] + a * (src.data[off + 4] - src.data[off]);
        p1r = src.data[off + (src_width * 4)] + a * (src.data[off + (src_width * 4) + 4] - src.data[off + (src_width * 4)]);
        p0g = src.data[off + 1] + a * (src.data[off + 4 + 1] - src.data[off + 1]);
        p1g = src.data[off + (src_width * 4) + 1] + a * (src.data[off + (src_width * 4) + 4 + 1] - src.data[off + (src_width * 4) + 1]);
        p0b = src.data[off + 2] + a * (src.data[off + 4 + 2] - src.data[off + 2]);
        p1b = src.data[off + (src_width * 4) + 2] + a * (src.data[off + (src_width * 4) + 4 + 2] - src.data[off + (src_width * 4) + 2]);
        dst.data[dptr + 0] = p0r + b * (p1r - p0r);
        dst.data[dptr + 1] = p0g + b * (p1g - p0g);
        dst.data[dptr + 2] = p0b + b * (p1b - p0b);
        dst.data[((i * (dst.width * 4)) + (j * 4)) + 3] = 255;
      }
      else {
        dst.data[((i * (dst.width * 4)) + (j * 4)) + 3] = 0;
      }
    }
  }
};

module.exports = { loadmodel, warmup, detect };
