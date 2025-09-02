import { MongoClient, Db, Collection } from 'mongodb'

let client: MongoClient | null = null
let db: Db | null = null

export async function getDb(): Promise<Db> {
  if (db) return db
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI not set')
  client = new MongoClient(uri)
  await client.connect()
  db = client.db(process.env.MONGODB_DB || undefined)
  return db!
}

export async function getCollection<T>(name: string): Promise<Collection<T>> {
  const d = await getDb()
  return d.collection<T>(name)
}

