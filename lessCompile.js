const _less = require('less');
const _ = require('lodash')
const _path = require('path')
module.exports = function(fileContent, options, realFilePath){
  //添加文件相对路径 编译时 import 导入相对路径
  let lessOptions = _.extend({},  options)
  if(_.indexOf(lessOptions.paths, _path.dirname(realFilePath)) == -1){
    lessOptions.paths.push(_path.dirname(realFilePath))
  }
  return new Promise((resolve, reject)=>{
    //----------- 全局 less 结束 ---------- //
    _less.render(fileContent, lessOptions, (e, result)=>{
      if(e){
        reject(e)
      }else{
        resolve(result.css) 
      }
    })
  })
  
}