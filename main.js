const path = require("path");
const fs = require("fs");
const sqlite3 = require('sqlite3');
const http = require('http')
const Guid = require('guid');

function init(guid) {
  const copyPath = "C:/Program Files (x86)/Thunder Network/Thunder/Profiles"
  const copyDbFilePath = `${copyPath}/TaskDb.dat`

  const toPath = `./copyFiles/${guid}`
  const toDbFilePath = `${toPath}/TaskDb.dat`

  fs.mkdirSync(toPath)
  fs.copyFileSync(copyDbFilePath, path.resolve(__dirname, toDbFilePath))

  const db = new sqlite3.Database(toDbFilePath, err => { })

  return {
    db,
    copyPath,
    toPath
  };
}

function close(db, filePath) {
  db.close(() => {
    try {
      var files = fs.readdirSync(filePath)
      files.forEach((item) => {
        fs.unlinkSync(path.resolve(filePath, item))
      })
      fs.rmdirSync(filePath)
    }
    catch (err) {
      return err
    }
  });
}

async function getDownloadingTask(guid) {
  const { db, copyPath, toPath } = init(guid)

  let resultList = [];
  const taskList = await getRowsBySql(db, 'SELECT Name,TaskId,Type,UserData FROM TaskBase where Status=5')
  if (taskList.length === 0) {
    return []
  }
  else {
    let taskLength = taskList.length;
    for (let index = 0; index < taskList.length; index++) {
      let taskId = taskList[index]['TaskId']

      let resItem = {
        taskId,
        fileName: taskList[index]['Name']
      }

      const copyTaskInfoExtTxtPath = `${copyPath}/TaskSpeedInfo/TaskInfoEx_${resItem.taskId}.txt`
      const toTaskInfoExtTxtPath = `${toPath}/TaskInfoEx_${resItem.taskId}.txt`

      fs.copyFileSync(copyTaskInfoExtTxtPath, path.resolve(__dirname, toTaskInfoExtTxtPath))
      const data = fs.readFileSync(toTaskInfoExtTxtPath, 'utf-8')

      try {
        let { progress, speedInfoMap = {} } = JSON.parse(data)
        let { downloadSpeed } = speedInfoMap[progress]

        resItem.progress = progress
        resItem.downloadSpeed = downloadSpeed / 1024
      }
      catch (e) {
        console.log("日志读取失败", e);
      }

      if (resItem.progress != 100) {
        resultList.push(resItem);
      }
      else {
        //任务表里是下载状态，但是日志文件里显示已经100了，所以将这些异常任务存起来，当作已完成处理。
        addUnusualList(resItem);
      }
    }

    close(db, toPath)

    return resultList
  }
}

async function getCompleteTask(guid) {
  const { db, toPath } = init(guid)

  let resultList = [];

  const taskList = await getRowsBySql(db, `select * from(
    sELECT 
    datetime(CompletionTime / 1000, 'unixepoch', 'localtime') || '.' || CAST(CASE WHEN LENGTH(CAST(CompletionTime % 1000 AS TEXT)) = 2 THEN('0' || CAST(CompletionTime % 1000 AS TEXT)) ELSE CompletionTime % 1000 END AS TEXT) AS CompletionTime, Name, TaskId, Type, UserData,DownloadingPeriod FROM TaskBase where Status = 8 and GroupTaskId=0
  ) order by CompletionTime desc`)

  if (taskList.length === 0) {
    return []
  }
  else {
    let taskLength = taskList.length;
    for (let index = 0; index < taskList.length; index++) {
      let resItem = {
        taskId: taskList[index]['TaskId'],
        fileName: taskList[index]['Name'],
        completionTime: taskList[index]['CompletionTime'],
        period: taskList[index]['DownloadingPeriod']
      }

      resultList.push(resItem);
    }

    close(db, toPath);


    return appendUnusualListToResult(resultList, unusualTaskList)
  }
}

function parseFileId(text) {
  const fileIdRes = /.*\"fileId\"\:\"(.*)\"\,\"link.*/.exec(text);
  if (fileIdRes) {
    return fileIdRes[1]
  }
  return ""
}

function getRowsBySql(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, function (err, rows) {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function start() {
  let index = 0;
  var server = http.createServer()

  server.listen(3000, function () {
    console.log('服务器启动成功了，可以通过 http://127.0.0.1:3000/ 来进行访问')
  })

  server.on('request', async function (request, response) {
    console.log('已经响应了', index++);

    const guid = Guid.create().value
    let res = []
    switch (request.url) {
      case "/":
      case "/task/downloading":
        res = await getDownloadingTask(guid)
        break;
      case "/task/complete":
        res = await getCompleteTask(guid)
        break;
    }

    response.write(JSON.stringify(res))
    response.end()
  })
}

start();

//因为xunlei本身有一个问题：当前下载任务如果完成了，不会立即更新数据库里的下载状态，会等下一个任务的才会更新。
//因此，就会始终有一个任务的状态，其实已经完成了，但是数据库里还是下载状态。
//此数组就是用于存储这些“异常”任务，方便用户请求已完成接口时，追加到结果中。
let unusualTaskList = [];

function addUnusualList(task) {
  const existFlag = unusualTaskList.some((unusualTask) => {
    if (unusualTask.taskId === task.taskId) {
      return true;
    }
    else {
      return false
    }
  })
  if (!existFlag) {
    unusualTaskList.push(task);
  }
}

function appendUnusualListToResult(resultList, unusualTaskList) {
  unusualTaskList.forEach((unusualTask) => {
    const existFlag = resultList.some((item) => {
      if (item.taskId === unusualTask.taskId) {
        return true;
      }
      else {
        return false
      }
    })
    if (!existFlag) {
      unusualTask.completionTime = "";
      unusualTask.period = "";
      resultList.unshift(unusualTask);
    }
  })

  return resultList
}
