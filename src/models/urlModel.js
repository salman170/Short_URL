const mongoose=require("mongoose");
const { Schema } = mongoose;

const urlSchema = new Schema({
    urlCode: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    longUrl: {
        type: String,
        required: true,
    },
    shortUrl: {
        type: String,
        required: true,
        unique: true,
    }

},{timestamps:true}
)

module.exports = mongoose.model("Url",urlSchema)