const express = require("express")
const router = express.Router();
const {createUrl,getUrl} = require("../controller/urlContronller")



router.get("/test",(req,res)=> res.status(200).send({status:true, msg:"I am working"}))

//<--------------------URL API's---------------------------->
router.post("/url/shorten", createUrl)
router.get("/:urlCode",getUrl)


module.exports = router