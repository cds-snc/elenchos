import { dbConnect } from "./connect";

const { Model } = require("./model");

export const saveReleaseToDB = async obj => {
  await dbConnect();
  const query = { refId: obj.refId };
  const options = { upsert: true, new: true, setDefaultsOnInsert: true };
  // find and update or insert new
  try {
    await Model.findOneAndUpdate(query, obj, options).exec();
    return;
  } catch (e) {
    console.log(e.message);
  }
};

export const getRelease = async (obj, query = { refId: obj.refId }) => {
  await dbConnect();
  try {
    let record = await Model.findOne(query).exec();

    // record.full_name= record

    return record;
  } catch (e) {
    console.log(e.message);
  }
};
