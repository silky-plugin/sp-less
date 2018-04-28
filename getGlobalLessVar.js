const _path = require('path')
const _ = require('lodash')
const _fs = require('fs')
const converToUrl = (pathname)=>{return pathname.replace(/(\\)+/g, "/")}
//添加公共库less模块公共变量
const getAddPubVarFunc= (isDev, globalLessContent)=>{
  return (pubModulesDir, moduleName, isPublib)=>{
    if(!isDev){
      globalLessContent.push(`@__imageRoot: "/image"`)
    }
    globalLessContent.push(isDev ? `@${moduleName}_img:"/${converToUrl(pubModulesDir)}/${moduleName}/image"`: `@${moduleName}_img:"@{__imageRoot}/${moduleName}"`)
  }
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

module.exports = (cli, realFilePath, globalLess, isDev)=>{
   //let fileContent = _fs.readFileSync(realFilePath, {encoding: 'utf8'})
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
  
    //获取环境相关全局less，添加到每个less文件后
    let _global = [].concat(globalLess)
    
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
        globalLessContent.push(`@import "${converToUrl(_path.join(pubModuleDir, pubModuleGlobalFileArray.join(_path.sep)))}";`)
        return
      }

      //less公共库 ["csslab"]不带文件后缀， 仅添加引用变量，不添加文件内容 
      if(filename.indexOf('.') == -1){
        let pubModuleName = filename
        let publicLibIndex = cli.getPublicLibIndex(filename)
        let pubModuleDir = cli.getPublicLibDir(pubModuleName);
        if(publicLibIndex){
          globalLessContent.push(`@${pubModuleName}_all: "${converToUrl(_path.join(pubModuleDir, publicLibIndex))}"`)
        }else{
          cli.log.warn(`less库 ${pubModuleName} 没有指定入口文件， 无法使用 import "@{${pubModuleName}_all}"`.yellow)
        }
        pushPubVarFunc(pubModuleDir, pubModuleName)
        globalLessContent.push(`@${pubModuleName}: "${converToUrl(pubModuleDir)}"`)
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
    return globalLessContent
}