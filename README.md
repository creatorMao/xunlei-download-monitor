# xunlei-download-monitor

# 关于&声明

- 本项目启动后会提供一个http接口，返回当前电脑上xunlei正在下载的任务信息。
- 如果你的xunlei安装在一个虚拟机内，你又想实时掌握当前下载进度，那么本项目适合您。你可以定时轮询此接口，获取下载进度。
- 只适用windows
- 本项目仅用于学习，无任何收集用户信息行为。

# 使用

## 1. 修改main.js 中xunlei安装路径

修改第8行

```
const copyPath = "C:/Program Files (x86)/Thunder Network/Thunder/Profiles"
```

## 2. 安装依赖

```
npm install
```

## 3. 启动

```
npm run server
```

## 4. 请求接口

端口:3000

### 获取正在下载的任务列表

```
http://127.0.0.1:3000/
或者
http://127.0.0.1:3000/task/downloading

[
  {
    "taskId":316900896,
    "fileName":"hhd800.com@MVSD-511.mp4\u0000",//任务名称，一般是文件名称
    "progress":74, //当前下载进度，max:100
    "downloadSpeed":542.341796875 //当前下载速度。单位kb
  }
]
```

### 获取已完成列表

```
http://127.0.0.1:3000/task/complete

[
  {
    "taskId":601392016,
    "fileName":"nsfs-116-4k.mp4\u0000",
    "completionTime":"2022-08-27 02:36:57.958",//下载完成时间
    "period":27018 //下载耗时，单位秒
  }
]
```

## 5. 缺陷

可能是官方的原因，存在以下问题
- 当你启动一个下载任务时，它不会立刻将下载任务更新到数据库文件中，因此在你启动下载任务的后几分钟内，请求【获取正在下载的任务列表】接口，不一定能获取到数据。

正因为这个问题，本项目也只适合监控下载时间稍长的任务。