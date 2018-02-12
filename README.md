# storages
本地存储,支持降级！

###### ES6语法，支持AMD/CMD/！

##### 参数设置
        ***   exp:   100,类型Number。超时时间，秒。默认无限大。
        ***   force: true,可删除
        ***   sign : 前缀Storage_,标示可自定义，
        ***   value: [必填] 支持所有可以JSON.parse 的类型。注：当为undefined的时候会执行 delete(key)操作。
 
 ##### API
        ***   set: 设置
        ***   get: 获取
        ***   delete : 删除，
        ***   deleteAll: 删除全部。
        ***   add：添加
        ***   replace：替换
        ***   search：搜索
        ***   clear：清除

