const path = require("path");
const fs = require("fs");
const sqlite3 = require('sqlite3');
const http = require('http')
const Guid = require('guid');

async function getTask(guid) {
  const copyPath = "C:/Program Files (x86)/Thunder Network/Thunder/Profiles"
  const copyDbFilePath = `${copyPath}/TaskDb.dat`

  const toPath = `./copyFiles/${guid}`
  const toDbFilePath = `${toPath}/TaskDb.dat`

  fs.mkdirSync(toPath)

  fs.copyFileSync(copyDbFilePath, path.resolve(__dirname, toDbFilePath))

  let resultList = [];

  const db = connectDB(toDbFilePath)
  const taskList = await getRowsBySql(db, 'SELECT TaskId,Type,UserData FROM TaskBase where Status=5')
  if (taskList.length === 0) {
    return []
  }
  else {
    let taskLength = taskList.length;
    for (let index = 0; index < taskList.length; index++) {
      let taskId = taskList[index]['TaskId']
      let fileInfo = undefined;

      switch (taskList[index]['Type']) {
        case 1:
          fileInfo = await getRowsBySql(db, `SELECT id,name,file_extension FROM user_file where id='${parseFileId(taskList[index].UserData.toString())}'`)
          break;
        case 2:
          fileInfo = await getRowsBySql(db, `SELECT BtFileId as id,FileName as name,'' as file_extension FROM BtFile where BtTaskId='${taskId}'`)
          break;
      }

      let resItem = {
        taskId,
        fileName: fileInfo[0].name.toString() + fileInfo[0].file_extension
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

      resultList.push(resItem);
    }

    db.close(() => {
      try {
        var files = fs.readdirSync(toPath)
        files.forEach((item) => {
          fs.unlinkSync(path.resolve(toPath, item))
        })
        fs.rmdirSync(toPath)
      }
      catch (err) {
        return err
      }
    });

    return resultList
  }
}

function parseFileId(text) {
  const fileIdRes = /.*\"fileId\"\:\"(.*)\"\,\"link.*/.exec(text);
  if (fileIdRes) {
    return fileIdRes[1]
  }
  return ""
}

function connectDB(dbFile) {
  return new sqlite3.Database(dbFile, err => { })
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

    const res = await getTask(Guid.create().value)
    response.write(JSON.stringify(res))
    response.end()
  })
}

start();