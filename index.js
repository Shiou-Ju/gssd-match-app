const dotenv = require("dotenv");
const mongoose = require("mongoose");
const fetch = require("node-fetch");
const Post = require("./models/Post");
const User = require("./models/User");
const Match = require("./models/Match");
const sendEmail = require("./sendEmail");

dotenv.config({ path: "./config.env" });

async function connectToDB() {
  await mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("已連上資料庫");
}

//搜尋是否已寄出認證信
async function searchIfSentConfirmed() {
  let users = await User.find({ isSentConfirmed: false, isCancelled: false });

  if (users.length === 0) {
    console.log(`=======所有使用者皆已收到認證信=======`);
  } else {
    let confirmationSent = [];

    for (i = 0; i < users.length; i++) {
      const email = users[i].email;
      const message = `感謝您註冊本服務，系統將會在收到有關公告後，立即通知您。\n\n您所填的應受送達人為：${users[i].name}。\n\n如您不需要使用此服務，歡迎隨時到訪我們的網站取消訂閱。`;
      const subject = "感謝您註冊公示送達訂閱服務";

      const options = { email: email, subject: subject, message };

      try {
        await sendEmail(options);
        //成功寄送確認信以後變更資料庫欄位成已寄送
        await User.findOneAndUpdate(
          { email: email, isSentConfirmed: false, isCancelled: false },
          { isSentConfirmed: true }
        );
        confirmationSent.push(options);
      } catch (error) {
        console.log(`${email}的認證信無法寄出`);
      }
    }

    console.log(`此次寄出${confirmationSent.length}筆認證信`);
  }
}

//搜尋是否有新配對
async function searchPostByEachUser() {
  let users = await User.find({ role: "user", isCancelled: false });

  let matchSent = [];

  for (i = 0; i < users.length; i++) {
    let postFind = await Post.find({
      addressee: { $regex: `${users[i].name}`, $options: "i" },
    });
    const email = users[i].email;
    console.log(
      `=======${users[i].email}的應受送達人為${users[i].name}=======`
    );

    if (postFind.length === 1) {
      let matchFinder = await Match.find({
        name: { $regex: `${users[i].name}`, $options: "i" },
        subscription: true,
        title: `${postFind[0].title}`,
        court: `${postFind[0].court}`,
        urlDetailed: `${postFind[0].urlDetailed}`,
        datePosted: `${postFind[0].datePosted}`,
      });

      if (matchFinder.length === 0) {
        let title = postFind[0].title;
        let court = postFind[0].court;
        let name = users[i].name;
        let datePosted = postFind[0].datePosted;
        let urlDetailed = postFind[0].urlDetailed;
        try {
          await sendMatchRequest(
            name,
            email,
            title,
            court,
            datePosted,
            urlDetailed
          );
          await matchSent.push({ name, title });
        } catch (error) {
          console.log(error);
        }
      } else {
        let matchSentDate = matchFinder[0].createdAt;
        console.log(
          `${users[i].name}的${postFind[0].title}已寄送過。寄送日期：${matchSentDate}。`
        );
      }
    } else if (postFind.length > 1) {
      for (x = 0; x < postFind.length; x++) {
        let matchFinder = await Match.find({
          name: { $regex: `${users[i].name}`, $options: "i" },
          subscription: true,
          title: `${postFind[x].title}`,
          court: `${postFind[x].court}`,
          urlDetailed: `${postFind[x].urlDetailed}`,
          datePosted: `${postFind[x].datePosted}`,
        });

        if (matchFinder.length === 0) {
          let title = postFind[x].title;
          let court = postFind[x].court;
          let name = users[i].name;
          let datePosted = postFind[x].datePosted;
          let urlDetailed = postFind[x].urlDetailed;
          try {
            await sendMatchRequest(
              name,
              email,
              title,
              court,
              datePosted,
              urlDetailed
            );
            await matchSent.push({ name, title });
          } catch (error) {
            console.log(error);
          }
        } else {
          let matchSentDate = matchFinder[0].createdAt;
          console.log(
            `${users[i].name}的${postFind[x].title}已寄送過。寄送日期：${matchSentDate}。`
          );
        }
      }
    } else {
      console.log(`${users[i].name}沒有找到對應的公告`);
    }
  }
  if (matchSent.length === 0) {
    console.log(`=======沒有新增任何的公告配對=======`);
  } else {
    console.log(`新增的公告配對數為${matchSent.length}`);
  }
}

//發現新公告後寄出給個別使用者
async function sendMatchRequest(
  name,
  email,
  title,
  court,
  datePosted,
  urlDetailed
) {
  let url = process.env.MATCH_REQUEST_URL;

  let formData = {
    name: `${name}`,
    email: `${email}`,
    title: `${title}`,
    court: `${court}`,
    datePosted: `${datePosted}`,
    urlDetailed: `${urlDetailed}`,
  };

  let data = await postData(url, formData);
  if (data.success === true) {
    console.log(`${name}的${title}處理完畢`);
  } else if (data.error === "已寄送此篇公告") {
    console.log(`${name}的${title}已經寄送過了`);
  } else {
    console.log(`發生非預期錯誤`);
  }

  function postData(url, data) {
    return fetch(url, {
      body: JSON.stringify(data),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    }).then((response) => response.json());
  }
}

// 檢查使用者天數是否超過180天，若是，則變更註冊資訊並發送通知信
async function checkIfOver180() {
  let users = await User.find({ role: "user", isCancelled: false });
  let deleteAmount = [];

  const oneDayInMs = 1000 * 60 * 60 * 24;

  for (i = 0; i < users.length; i++) {
    let dateRegistered = users[i].createdAt;
    const dateNow = new Date();
    const timeDiff = new Date(dateNow - dateRegistered);
    const timeDiffInDays = Math.round(timeDiff / oneDayInMs);

    if (timeDiffInDays > 180) {
      const url = process.env.CANCEL_BY_EXPIRE_API;
      let email = users[i].email;
      let formData = {
        email: `${email}`,
      };

      let data = await postData(url, formData);
      if (data.success === true) {
        console.log(`${email}用戶過期已處理完畢`);
      } else if (data.error === "用戶資訊錯誤") {
        console.log(`${email}用戶目前非處於註冊狀態`);
      } else {
        console.log(`發生非預期錯誤`);
      }

      function postData(url, data) {
        return fetch(url, {
          body: JSON.stringify(data),
          headers: {
            "content-type": "application/json",
          },
          method: "POST",
        }).then((response) => response.json());
      }
      deleteAmount.push(email);
    }
  }
  if (deleteAmount.length === 0) {
    console.log(`=======沒有用戶過期=======`);
  } else {
    console.log(`過期之用戶數為${deleteAmount.length}`);
  }
}

//主執行器
async function main() {
  await connectToDB();

  //搜尋是否有漏寄認證信之用戶
  try {
    await searchIfSentConfirmed();
  } catch (error) {
    console.log(error);
  }

  //執行搜尋是否有相對應公告
  try {
    await searchPostByEachUser();
  } catch (error) {
    console.log(error);
  }

  //執行搜尋是否有用戶過期
  try {
    await checkIfOver180();
  } catch (error) {
    console.log(error);
  }

  console.log("程序結束");
  process.exit();
}

main();
