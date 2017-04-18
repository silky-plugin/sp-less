'use strict';
const _url = require('url');
const _path = require('path');
const _fs = require('fs');
const _less = require('less');
const _ = require('lodash');


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

//根据json格式化为less变量
const getLessVarFromJSON = (json)=>{
  if(!json){return ""}
  let queue = [];
  Object.keys(json).forEach((key)=>{
    queue.push(`@${key}:"${json[key]}";`)
  });
  return queue.join('')
}
//添加公共库less模块公共变量
const getAddPubVarFunc= (isDev, globalLessContent)=>{
  return (pubModulesDir, moduleName, isPublib)=>{
    if(!isDev){
      globalLessContent.push(`@__imageRoot: "/images"`)
    }
    let varNameList = isPublib ? ["__pub", moduleName] : [moduleName]
    varNameList.forEach((name)=>{
      globalLessContent.push(isDev ? `@${name}_img:"/${pubModulesDir}/${moduleName}/images"`: `@${name}_img:"@{__imageRoot}/${moduleName}"`)
    })
  }
}

//根据实际路径获取文件内容
const getCompileContent = (cli, realFilePath, data, isDev, cb)=>{
  if(!_fs.existsSync(realFilePath)){
    data.status = 404
    return cb(null, null)
  }
  let fileContent = _fs.readFileSync(realFilePath, {encoding: 'utf8'})
  let globalLessContent = []
  let pushPubVarFunc = getAddPubVarFunc(isDev, globalLessContent)
  //----- 服务 node_modules less的image------ start
  let pubModulesDir = cli.options.pubModulesDir
  //如果less中包含公共组件
  if(realFilePath.indexOf(pubModulesDir) != -1){
    //获取组建名称
    let filePathSplitArray = realFilePath.split(_path.sep)
    let moduleName = filePathSplitArray[_.indexOf(filePathSplitArray, pubModulesDir) + 1]
    pushPubVarFunc(pubModulesDir, moduleName, true)
  }
  //----- 服务 node_modules less的image ------ END

  //----------- 全局 less 开始 ---------- //
  //获取环境配置的global时，可能会报错
  try{
    //获取环境相关全局less，添加到每个less文件后
    let _global = [].concat(_DefaultSetting.global)
    
    _global.forEach((filename)=>{
      if(!filename){return}

      //less公共库指定了 必须添夹到每个文件后的全局文件
      if(filename.indexOf('/') != -1){
        let pubModuleGlobalFileArray = filename.split('/');
        let pubModuleName = pubModuleGlobalFileArray.shift();
        let pubModuleDir = cli.getPublicLibDir(pubModuleName);
        let beAddEveryFileBehindFilePath = _path.join(cli.cwd(), pubModuleDir, pubModuleGlobalFileArray.join(_path.sep))
        if(!_fs.existsSync(beAddEveryFileBehindFilePath)){
          throw new Error(`Cannot find public module ${pubModuleName}'s file ${pubModuleGlobalFileArray.join('/')}`)
        }
        pushPubVarFunc(pubModuleDir, pubModuleName)
        globalLessContent.push(`@import "${_path.join(pubModuleDir, pubModuleGlobalFileArray.join(_path.sep)).replace(/\\/g, "/")}";`)
        return
      }

      //less公共库 ["csslab"]不带文件后缀， 仅添加引用变量，不添加文件内容 
      if(filename.indexOf('.') == -1){
        let pubModuleName = filename
        let publicLibIndex = cli.getPublicLibIndex(filename)
        let pubModuleDir = cli.getPublicLibDir(pubModuleName);
        if(publicLibIndex){
          globalLessContent.push(`@${pubModuleName}_all: "${_path.join(pubModuleDir, publicLibIndex).replace(/\\/g, "/")}"`)
        }else{
           cli.log.warn(`less库 ${pubModuleName} 没有指定入口文件， 无法使用 import "@{${pubModuleName}_all}"`.yellow)
        }
        pushPubVarFunc(pubModuleDir, pubModuleName)
        globalLessContent.push(`@${pubModuleName}: "${pubModuleDir.replace(/\\/g, "/")}"`)
        return
      }
      if(/(\.less)$/.test(filename)){
        globalLessContent.push(cli.runtime.getRuntimeEnvFile(filename, true));
        return
      }
      if(/(\.js)$/.test(filename)){
        globalLessContent.push(getLessVarFromJSON(cli.runtime.getRuntimeEnvFile(filename)));
        return
      }
    })
    globalLessContent.push(fileContent);
    fileContent =  globalLessContent.join(';');
  }catch(e){
    return cb(e)
  }
  
  //添加文件相对路径 编译时 import 导入相对路径
  let lessOptions = _.extend({},  _DefaultSetting.options)
  if(_.indexOf(lessOptions.paths, _path.dirname(realFilePath)) == -1){
    lessOptions.paths.push(_path.dirname(realFilePath))
  }

  //----------- 全局 less 结束 ---------- //
  _less.render(fileContent, lessOptions, (e, result)=>{
    if(e){
      console.log(e)
      return cb(e)
    }
    //编译成功，标记状态码
    data.status = 200;
    cb(null, result.css)
  })
}

function needIgnore(filename, ignoreRegList){
  for(let i = 0, length = ignoreRegList.length; i < length; i++){
    //兼容windows 文件路径判断
    filename = filename.replace(/(\\)+/g, "/")
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

    getCompileContent(cli, realFilePath, data, true, (error, content)=>{
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

    getCompileContent(cli, inputFilePath, data, false, (error, content)=>{
      if(error){return cb(error)};
      if(data.status == 200){
        data.outputFilePath = data.outputFilePath.replace(/(\less)$/, "css");
        data.outputFileRelativePath = data.outputFileRelativePath.replace(/(\less)$/, "css")
      }
      cb(null, content);
    })
  })
}