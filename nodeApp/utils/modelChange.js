const dbName = process.env.BASE_DB_NAME;
const auditCollectionName = process.env.AUDIT_COLLECTION_NAME;
const ObjectId = require("mongodb").ObjectId;

module.exports = (dbClient, passport) => {

    async function runScript(req, res, next) {
        const db = dbClient.db(dbName);
        const audits = await db.collection(auditCollectionName).find({}).toArray();
        audits.map(au => {
            const arra = au['#controlled_copy'].split('-').reverse();
            const printNumber = arra[0];
            const revision = arra[1];
            arra.splice(0, 2);
            arra.pop();
            const documentName = arra.reverse().join('-');
            db.collection(auditCollectionName).update({'_id': ObjectId(au._id)},{
                $set:{
                    "printNumber" : printNumber,
                    "revision": revision,
                    "documentName": documentName
                }
            },{upsert: true});

        });
        req.payload = {
            status: 'success'
        };
        next();
    }

    return {
        runScript
    }
}