//--------------------------------Importing Modules--------------------------------//

const urlModel = require("../models/urlModel")
const validUrl = require("valid-url")
const shortid = require("shortid")
const redis = require("redis");
const { promisify } = require("util");
const baseUrl = "http://localhost:3000";
const timeLimit = 20 * 60; //after 20 min cache data will clear automatically.

//-------------------------------- GLobal Validation Defined--------------------------------//

const isValidRequestBody = (RequestBody) => {
  if (!Object.keys(RequestBody).length > 0) return false;
  return true;
};

const isValid = (value) => {
  if (typeof value === "undefined" || typeof value === null) return false;
  if (typeof value === "string" && value.trim().length === 0) return false;
  return true;
};

let regexUrl =
  /^(https[s]?:\/\/){0,1}(www\.){0,1}[a-zA-Z0-9\.\-]+\.[a-zA-Z]{2,5}[\.]{0,1}/;

//--------------------Connect to Redis || Connection setup for redis---------------------------->>>//

const redisClient = redis.createClient(
  14431,
  "redis-14431.c212.ap-south-1-1.ec2.cloud.redislabs.com",
  { no_ready_check: true }
);

redisClient.auth("MxfQxTtqnI6TQeXdgYxM97XgDVeZPBn9", function (err) {
  if (err) throw err;
});

//------ Connect to the Server---------------->>

redisClient.on("connect", async function (err) {
  if (err) throw err;
  console.log("Connected to Redis!");
});

//------- Connection Setup for Redis------->>

// //1. connect to the server
// //2. use the commands :
const SET_ASYNC = promisify(redisClient.SET).bind(redisClient);
const GET_ASYNC = promisify(redisClient.GET).bind(redisClient);


//----------------------- API Controllers--------------------------------//

//--------------------------Create URL-----------------------------//

const createUrl = async (req, res) => {
  try {
    let body = req.body

    const { longUrl, ...rest } = body

    //----------------- Intial Validation of Data ----------------//

    if (!isValidRequestBody(body)) return res.status(400).send({ status: false, message: "Please provide data in body :)" })

    if (!longUrl) return res.status(400).send({ status: false, message: `longUrl is mandatory!` })

    if (!isValid(longUrl)) return res.status(400).send({ status: false, message: `longUrl will in string only.` });

    if (Object.keys(rest).length > 0) return res.status(400).send({ status: false, message: `This {${Object.keys(rest)}} field is not required` })

    if (typeof longUrl != "string" || longUrl.trim() == "") return res.status(400).send({ status: false, message: `longUrl will in string only.` })

    if (!regexUrl.test(longUrl.trim()) || !validUrl.isWebUri(longUrl)) return res.status(400).send({ status: false, message: `This longUrl is not valid. (${longUrl})  ` })

    // <<--------- Get DAta from the Cache Memory ---------->>

    let cachelongUrl = await GET_ASYNC(`${longUrl}`);


    if (cachelongUrl) {
      console.log("<-----------------------------------Data from radis------------------------------------->");
      console.log(cachelongUrl)
      return res.status(200).send({ status: true, message: "Data from Redis", data: JSON.parse(cachelongUrl), });
    }

    //<----------------------------checking for url in Database----------------------->
    let urlFind = await urlModel.findOne({ longUrl: longUrl }).select({ createdAt: 0, updatedAt: 0, __v: 0, _id: 0 });

    if (urlFind) {
      await SET_ASYNC(`${longUrl}`, JSON.stringify(urlFind), "EX", timeLimit)

      console.log("<-----------------------------------Data from mongoDb------------------------------------->");
      console.log(urlFind)
      return res.status(200).send({ status: true, message: "data from mongoDb Database", data: urlFind });
    }

    // ---------------- Create Urlcode -------------------->>
    let urlCode = shortid.generate(longUrl).toLowerCase()
    body.urlCode = urlCode

    let shortUrl = baseUrl + "/" + urlCode;
    body.shortUrl = shortUrl

    let urlSave = await urlModel.create(body)
    const newData = {
      longUrl: urlSave.longUrl,
      urlCode: urlSave.urlCode,
      shortUrl: urlSave.shortUrl,
    };

    //<<---------------Set Data in Chache Memory Server-------->>

    await SET_ASYNC(`${longUrl}`, JSON.stringify(newData), "EX", timeLimit);
    // await SET_ASYNC(`${shortUrl}`, JSON.stringify(longUrl));
    console.log("<-----------------------------------Data from mongoDb------------------------------------->");
    console.log(urlSave)

    return res.status(201).send({ status: true, message: "data create in mongoDb server and set to redis", data: newData });


  } catch (err) {
    console.log(err.message)
    res.status(500).send({ status: false, error: err.message })
  }
}



//< -------------------------------- Get Or Redirect URL -------------------------------->//
//< -------------------------------- ___________________-------------------------------->//

const getUrl = async function (req, res) {
  try {
    let param = req.params.urlCode

    if (!shortid.isValid(param)) return res.status(400).send({ status: false, massage: "Enter valid shortid!!!! " });

    let cacheUrlData = await GET_ASYNC(`${param}`);
    cacheUrlData = JSON.parse(cacheUrlData);
    if (cacheUrlData) {
      console.log("<-----------------------------------Data from radis------------------------------------->")
      console.log(cacheUrlData)
      return res.status(302).redirect(cacheUrlData)
    }
    else console.log(`No data in cache/Radis for this (${param}) shortUrl`)

    //<<-------------------------- Get Data From Cache Memory ------------------------------->>

    let findUrl = await urlModel.findOne({ urlCode: param }).select({ longUrl: 1, _id: 0 })

    if (!findUrl) return res.status(400).send({ status: false, message: "This short url is not exixt in the db" })

    if (findUrl == null) return res.status(404).send({ status: false, message: `No url found with this ${param}` })

    if (findUrl) {
      console.log("<-----------------------------------Data from Mongodb------------------------------------->")
      console.log(findUrl.longUrl)
      await SET_ASYNC(`${param}`, JSON.stringify(findUrl.longUrl), "EX", timeLimit)
      return res.status(302).redirect(findUrl.longUrl)
    }
  }
  catch (err) { return res.status(500).send({ status: false, error: err.message }) }
}


//------------------------ Exporting Modules-------------------------//

module.exports = { createUrl, getUrl };

