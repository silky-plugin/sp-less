'use strict';
const _url = require('url');
const _path = require('path');
const _fs = require('fs');
const _less = require('less');
const _ = require('lodash');


var _DefaultSetting = {
  "regexp": "(\.css)$",
  "options":{
    paths: ['.']
  },
  ignore: [],
  global: [],
  _golbal: []
}

//判断该文件是否需要处理
const isNeedCompile = (pathname)=>{
  let reg = new RegExp(_DefaultSetting.regexp)
  return reg.test(pathname.toLowerCase())
}

//根据json格式化为less变量
const getLessVarFromJSON = (json)=>{
  if(!json){return ""}
  let queue = [];
  Object.keys(json).forEach((key)=>{
    queue.push(`@${key}:"${json[key]}";`)
  });
  return queue.join('')
}

//根据实际路径获取文件内容
const getCompileContent = (cli, realFilePath, data, cb)=>{
  if(!_fs.existsSync(realFilePath)){
    data.status = 404
    return cb(null, null)
  }

  let fileContent = _fs.readFileSync(realFilePath, {encoding: 'utf8'})
  //----------- 全局 less 开始 ---------- //
  //获取环境配置的global时，可能会报错
  try{
    let globaleLessContent = [fileContent];
    let lessGlobal = [].concat(_DefaultSetting.global)
    //获取环境相关全局less，添加到每个less文件后
    let _env_global = [].concat(_DefaultSetting._env_global)
    _env_global.forEach((filename)=>{
      if(!filename){return}
      if(/(\.less)$/.test(filename)){
        globaleLessContent.push(cli.runtime.getRuntimeEnvFile(filename, true));
      }else{
        globaleLessContent.push(getLessVarFromJSON(cli.runtime.getRuntimeEnvFile(filename)));
      }

    })

    //获取全局less，添加到每个less文件后
    lessGlobal.forEach((filename)=>{
      if(!filename){return}
      globaleLessContent.push(_fs.readFileSync(_path.join(cli.cwd(), filename)));
    });

    fileContent =  globaleLessContent.join(';');
  }catch(e){
    return cb(e)
  }
  //----------- 全局 less 结束 ---------- //
  _less.render(fileContent, _DefaultSetting.options, (e, result)=>{
    if(e){return cb(e)}
    //编译成功，标记状态码
    data.status = 200;
    cb(null, result.css)
  })
}

function needIgnore(filename, ignoreRegList){
  for(let i = 0, length = ignoreRegList.length; i < length; i++){
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

  cli.registerHook('route:didRequest', (req, data, content, cb)=>{

    //如果不需要编译
    if(!isNeedCompile(req.path)){
      return cb(null, content)
    }
    let fakeFilePath = _path.join(cli.cwd(), req.path);
    //替换路径为less
    let realFilePath = fakeFilePath.replace(/(css)$/,'less')

    getCompileContent(cli, realFilePath, data, (error, content)=>{
      if(error){return cb(error)};
      //交给下一个处理器
      cb(null, content)
    })
  })

  cli.registerHook('build:doCompile', (buildConfig, data, content, cb)=>{
    let inputFilePath = data.inputFilePath;
    if(!/(\.less)$/.test(inputFilePath)){
      return cb(null, content)
    }

    _DefaultSetting.ignore = [].concat(_DefaultSetting.global).concat(_DefaultSetting.ignore)
    //查看忽略
    if(_DefaultSetting.ignore && _DefaultSetting.ignore.length > 0){
      if(needIgnore(inputFilePath, _DefaultSetting.ignore)){
        data.ignore = true;
        return cb(null, content)
      }
    }

    getCompileContent(cli, inputFilePath, data, (error, content)=>{
      if(error){return cb(error)};
      if(data.status == 200){
        data.outputFilePath = data.outputFilePath.replace(/(\less)$/, "css");
        data.outputFileRelativePath = data.outputFileRelativePath.replace(/(\less)$/, "css")
      }
      cb(null, content);
    })
  })
}