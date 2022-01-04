/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */

const fetchWechat = require('fetch-wechat');
const plugin = require('./utils/plugin_config.js');
const faceapi = require('./utils/face-api.js');
const ENABLE_DEBUG = false;
//app.js
App({
  onLaunch: function () {
    plugin.configPlugin({
      fetchFunc: fetchWechat.fetchFunc(),
      tf: faceapi.tf,
      canvas: wx.createOffscreenCanvas()
    },
      ENABLE_DEBUG);
    wx.cloud.init({
      env: 'cloud1-9gn0fti4c708fb57',
      traceUser: true
    })
    console.log(wx.cloud)
  }
})
