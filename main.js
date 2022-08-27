const path = require("path");
const fs = require("fs");
const sqlite3 = require('sqlite3');
const http = require('http')
const Guid = require('guid');

function prePare(guid) {

  const copyPath = "C:/Program Files (x86)/Thunder Network/Thunder/Profiles"
  const copyDbFilePath = `${copyPath}/TaskDb.dat`

  const toPath = `./copyFiles/${guid}`
  const toDbFilePath = `${toPath}/TaskDb.dat`

  fs.mkdir(toPath, () => {
  })

  return new Promise((resolve) => {
    fs.copyFile(
      copyDbFilePath,
      path.resolve(__dirname, toDbFilePath),
      (res) => {
        console.log(res);
        resolve(res);
      }
    )
  })
    .then(() => {
      let resultList = [];
      return new Promise((resolve) => {
        const db = connectDB(toDbFilePath)
        getData(db, 'SELECT TaskId,Type,UserData FROM TaskBase where Status=5')
          .then((res) => {
            if (res.length === 0) {
              resolve([]);
              return []
            }
            else {
              return res
            }
          })
          .then((res) => {
            let taskLength = res.length;
            for (let index = 0; index < res.length; index++) {
              let taskId = res[index]['TaskId']

              let next=undefined;
              switch(res[index]['Type']){
                case 1:
                  console.log('1');
                  let fileId = parseFileId(res[index].UserData.toString());
                  next=getData(db, `SELECT id,name,file_extension FROM user_file where id='${fileId}'`)
                  break;
                case 2:
                  console.log('2');
                  next=getData(db, `SELECT BtFileId as id,FileName as name,'' as file_extension FROM BtFile where BtTaskId='${taskId}'`)
                  break;
              }

              
              next.then((res) => {
                  let resItem = {
                    taskId,
                    fileName: res[0].name.toString() + res[0].file_extension
                  }

                  const copyTaskInfoExtTxtPath = `${copyPath}/TaskSpeedInfo/TaskInfoEx_${resItem.taskId}.txt`
                  const toTaskInfoExtTxtPath = `${toPath}/TaskInfoEx_${resItem.taskId}.txt`

                  fs.copyFile(
                    copyTaskInfoExtTxtPath,
                    path.resolve(__dirname, toTaskInfoExtTxtPath),
                    (res) => {
                      fs.readFile(toTaskInfoExtTxtPath, 'utf-8', (err, data) => {
                        try {
                          let downloadInfo = JSON.parse(data)
                          const progress = downloadInfo.progress
                          resItem.progress = progress
                          resItem.downloadSpeed = downloadInfo.speedInfoMap[progress].downloadSpeed / 1024
                        }
                        catch (e) {
                          console.log(e);
                          console.log(data);
                        }

                        resultList.push(resItem);

                        if (resultList.length === taskLength) {
                          resolve(resultList);
                        }
                      })

                    }
                  )


                })
            }
          })
          .finally(() => {
            db.close(()=>{
            });
          })
      })
    })
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

function getData(db, sql) {
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


var server = http.createServer()

server.on('request', function (request, response) {
  try{
    const guid=Guid.create().value
    prePare(guid)
      .then((res) => {
        response.write(JSON.stringify(res))
        response.end()
      })
      .finally(()=>{
        const toPath=`./copyFiles/${guid}`
        var files = fs.readdirSync(toPath)
        files.forEach((item) => {
          fs.unlinkSync(path.resolve(toPath, item))
        })
        fs.rmdirSync(toPath)
      })
  }
  catch(err){
    response.write(JSON.stringify({
      msg:err
    }))
    response.end()
  }
})

server.listen(3000, function () {
  console.log('服务器启动成功了，可以通过 http://127.0.0.1:3000/ 来进行访问')
})
