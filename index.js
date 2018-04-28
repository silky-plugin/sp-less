'use strict';
const _url = require('url');
const _path = require('path');
const _fs = require('fs');
const _less = require('less');
const _ = require('lodash');
const _getGlobalLessVar = require('./getGlobalLessVar')
const _lessComplie = require('./lessCompile')

var _DefaultSetting = {
  "regexp": "(\.css)$",
  "options":{
    paths: []
  },
  ignore: [],
  global: []
}

//判断该文件是否需要处理
const isNeedCompile = (pathname)=>{
  let reg = new RegExp(_DefaultSetting.regexp)
  return reg.test(pathname.toLowerCase())
}

const converToUrl = (pathname)=>{return pathname.replace(/(\\)+/g, "/")}

function needIgnore(filename, ignoreRegList){
  for(let i = 0, length = ignoreRegList.length; i < length; i++){
    //兼容windows 文件路径判断
    filename = converToUrl(filename)
    if(new RegExp(ignoreRegList[i]).test(filename)){
      return true
    }
  }
  return false
}


function setLessOptiosn(cli, options){
  _.extend(_DefaultSetting, options);

  if(_.indexOf(_DefaultSetting.options.paths, cli.cwd()) == -1){
    _DefaultSetting.options.paths.push(cli.cwd())
  }
  if(_.indexOf(_DefaultSetting.options.paths, '.') == -1){
    _DefaultSetting.options.paths.push('.')
  }
  let paths = [];
  _DefaultSetting.options.paths.forEach((path)=>{
    if(path == '.'){
      paths.push(path)
      return
    }
    if(path == cli.cwd()){
      paths.push(path)
      return
    }
    paths.push(_path.join(cli.cwd(), path))
  })

  _DefaultSetting.options.paths = paths

}

exports.registerPlugin = function(cli, options){
  //继承定义
  setLessOptiosn(cli, options)

  cli.registerHook('route:didRequest',async (req, data, content)=>{
    //如果不需要编译
    if(!isNeedCompile(req.path)){
      return content
    }
    let fakeFilePath = _path.join(cli.cwd(), req.path);
    //替换路径为less
    let realFilePath = fakeFilePath.replace(/(css)$/,'less')
    if(!_fs.existsSync(realFilePath)){
      return content
    }
    let fileContent = _fs.readFileSync(realFilePath, {encoding: 'utf8'})
    let globalVarQueue = _getGlobalLessVar(cli, realFilePath, _DefaultSetting.global, true)
    globalVarQueue.push(fileContent)
    fileContent = globalVarQueue.join(';')
    content = await _lessComplie(fileContent,  _DefaultSetting.options, realFilePath)
    return content
  })

  cli.registerHook('build:doCompile', async (buildConfig, data, content)=>{
    let inputFilePath = data.inputFilePath;
    if(!/(\.less)$/.test(inputFilePath)){
      return content
    }
    
    _DefaultSetting.ignore = [].concat(_DefaultSetting.global).concat(_DefaultSetting.ignore)
    //查看忽略
    if(_DefaultSetting.ignore && _DefaultSetting.ignore.length > 0){
      if(needIgnore(inputFilePath, _DefaultSetting.ignore)){
        data.ignore = true;
        return content
      }
    }
    let fileContent = _fs.readFileSync(inputFilePath, {encoding: 'utf8'})
    let globalVarQueue = _getGlobalLessVar(cli, inputFilePath, _DefaultSetting.global, true)
    globalVarQueue.push(fileContent)
    fileContent = globalVarQueue.join(';')

    content = await _lessComplie(fileContent,  _DefaultSetting.options, inputFilePath)
    data.status = 200
    data.outputFilePath = data.outputFilePath.replace(/(\less)$/, "css");
    data.outputFileRelativePath = data.outputFileRelativePath.replace(/(\less)$/, "css")
    return content
  })
}