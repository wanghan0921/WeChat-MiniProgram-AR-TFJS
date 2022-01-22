// 画布
const canvas1 = 'canvas1'
const canvas2 = 'canvas2'
// 示例图片
const sampleImage1 = './assets/wave1.jpg'
const sampleImage2 = './assets/wave2.jpg'
// 画布最大宽度
const maxCanvasWidth = 375
// wasm路径
global.wasm_url = '/package_lesson2/assets/opencv3.4.16.wasm.br'
// opencv_exec.js会从global.wasm_url获取wasm路径
let cv = require('./assets/opencv_exec.js');

Page({
	// 画布的dom对象
	canvasDom: null,
	canvasDom2: null,
	data: {
		canvas1Width: 375,
		canvas1Height: 150,
		// 示例图片
		sampleImage1Url: sampleImage1,
		sampleImage2Url: sampleImage2,
		result: null
	},
	onReady() {
		// 可见的画布
		// this.initCanvas(canvas1)
		// this.initCanvas2(canvas2)
	},
	// 获取画布
	initCanvas(canvasId) {
		var _that = this;
		wx.createSelectorQuery()
			.select('#' + canvasId)
			.fields({ node: true, size: true })
			.exec((res) => {
				const canvas2d = res[0].node;
				// 设置画布的宽度和高度
				canvas2d.width = res[0].width;
				canvas2d.height = res[0].height;
				_that.canvasDom = canvas2d
			});
	},
	initCanvas2(canvasId) {
		var _that = this;
		wx.createSelectorQuery()
			.select('#' + canvasId)
			.fields({ node: true, size: true })
			.exec((res) => {
				const canvas2d = res[0].node;
				// 设置画布的宽度和高度
				canvas2d.width = res[0].width;
				canvas2d.height = res[0].height;
				_that.canvasDom2 = canvas2d
			});
	},
	// 获取图像数据和调整图像大小
	getImageData(image,offscreenCanvas) {
		var _that = this
		// const ctx = wx.createCanvasContext(canvasId);
		var canvasWidth = image.width;
		if (canvasWidth > maxCanvasWidth) {
			canvasWidth = maxCanvasWidth;
		}
		// canvas Height
		var canvasHeight = Math.floor(canvasWidth * (image.height / image.width));
		// 离屏画布的宽度和高度不能小于图像的
		offscreenCanvas.width = canvasWidth;
		offscreenCanvas.height = canvasHeight;
		// draw image on canvas
		var ctx = offscreenCanvas.getContext('2d')
		ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);
		// get image data from canvas
		var imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);

		return imgData
	},
	// 创建图像对象
	async createImageElement(imgUrl) {
		var _that = this
		// 创建2d类型的离屏画布（需要微信基础库2.16.1以上）
		var offscreenCanvas = wx.createOffscreenCanvas({type: '2d'});
		const image = offscreenCanvas.createImage();
		await new Promise(function (resolve, reject) {
			image.onload = resolve
			image.onerror = reject
			image.src = imgUrl
		})
		const imageData = _that.getImageData(image,offscreenCanvas)
		return imageData
	},
	imgProcess1(imageData,  image2Data, canvasDom) {
		console.log('---',cv.matchShapes)
		console.log('---',cv.CONTOURS_MATCH_I3)
		// 读取图像
		let src1 = cv.imread(imageData);
		let src2 = cv.imread(image2Data);
		// cv.matchShapes(imageData, image2Data, cv.CONTOURS_MATCH_I3, 0)
		console.log(src1)

		// let dst = new cv.Mat();
		
		cv.matchShapes(src1, src2, cv.CONTOURS_MATCH_I3, 0)
		// 灰度化
		// cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
		// 显示图像
		// cv.imshow(canvasDom, dst);
		// 回收对象
		src1.delete();
		src2.delete();
		// dst.delete()
	},
	imgProcess2(imageData, imageData2, canvasDom, canvasDom2) {
		let src = cv.imread(imageData);
		let src2 = cv.imread(imageData2);
		let dst = new cv.Mat();
		let dst2 = new cv.Mat();

		// 灰度化
		cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY, 0);
		cv.cvtColor(src2, src2, cv.COLOR_RGBA2GRAY, 0);
		// // 边缘检测
		cv.Canny(src, dst, 50, 100, 3, false);
		cv.Canny(src2, dst2, 50, 100, 3, false);
		// console.log(dst, dst2 , dst === dst2)

		const diff = cv.matchShapes(src, src2, cv.CONTOURS_MATCH_I3, 0)
		this.setData({result: diff})
		console.log(diff)

		// cv.imshow(canvasDom, dst);
		// cv.imshow(canvasDom2, dst2);
		src.delete();
		src2.delete();
		dst.delete()
	},
	imgProcess3(imageData, imageData2, canvasDom) {
		let src = cv.imread(imageData);
		let src2 = cv.imread(imageData2);
		let dst = new cv.Mat();
		console.log(dst)

		// 灰度化
		// cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);
		// cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY, 0);

		var orb = new cv.ORB();
		var keypoints = new cv.KeyPointVector();
		var descriptors = new cv.Mat();
		// 特征点
		orb.detect(src, keypoints)
		orb.detect(src2, keypoints)
		// 特征点的描述因子
		// orb.compute(src, keypoints, descriptors)
		// orb.compute(src2, keypoints, descriptors)

		const diff = cv.matchShapes(src, src2, cv.CONTOURS_MATCH_I2, 0)
		console.log(diff)
		// 绘制特征点
		 cv.drawKeypoints(src, keypoints, dst)

		cv.imshow(canvasDom, dst);
		src.delete();
		dst.delete()
	},
	async btnRun1() {
		var _that = this;
		// 将图像转换为ImageData
		const image1Data = await _that.createImageElement(sampleImage1)
		const image2Data = await _that.createImageElement(sampleImage2)
		// 设置画布的显示大小
		_that.setData({
			canvas1Width: image1Data.width,
			canvas1Height: image1Data.height,
		})
		_that.imgProcess1(image1Data, image2Data, _that.canvasDom)
	},
	async btnRun2() {
		// 同上
		var _that = this;
		const image1Data = await _that.createImageElement(sampleImage1)
		const image2Data = await _that.createImageElement(sampleImage2)
		_that.setData({
			canvas1Width: image1Data.width,
			canvas1Height: image1Data.height,
		})
		_that.imgProcess2(image1Data, image2Data, _that.canvasDom, _that.canvasDom2)
	},
	async btnRun3() {
		// 同上
		var _that = this;
		const image1Data = await _that.createImageElement(sampleImage1)
		const image2Data = await _that.createImageElement(sampleImage2)
		_that.setData({
			canvas1Width: image1Data.width,
			canvas1Height: image1Data.height,
		})
		_that.imgProcess3(image1Data,image2Data, _that.canvasDom)
	},
})
