## 编译less文件

配置项：

```js
...
"silky-plugin":{
  "sp-less": {
    "global": ["global.less"], //or "global.less"
    "ignore": [
      "(css/module/)"
    ]
  }
  ...
}
...  
```


""

### global

文件名或文件名数组（string, Array<string>）

读取指定的环境等文件 添加到每一个文件中。 如: `"global": ["global.less"]`使用 `silky start -e production`, `silky build -e production` 读取文件等顺序是:
(不存在读下一个，存在则返回存在的文件内容加入到每个文件末尾)

```
 .silky/production／global.less -> .silky/normal／global.less
```

提示尽量使用`production` or `develop`文件和`normal`文件夹。

如果global中的某项没有带任何文件后缀,如`"global": ["global.less", "publibc"]`

### __pub

当引用了一个 公共库到时候, 每个库里面的less 引用 image时，必须用变量 `@{__pub}` 开始，如： `@{__pub}/a.png`， 实际为 `/images`, 便于替换

### __imageRoot
可以在全局变量中设置该值（仅在silky build时有用），用来取代 `@{__pub}` 部分的根目录 `/`

### ignore
符合正则表达式的string字符串。 一般作为模块组件的less文件，使用这个字段标记，避免编译组件到`build`文件夹内。 上述`global`引用的文件将自动加入到`ignore`中来。


