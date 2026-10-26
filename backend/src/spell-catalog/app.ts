import Fastify from 'fastify';
import { SpellCatalog } from './repository.js';
import type { SpellFilters } from './types.js';
import { EquipmentCatalog } from './equipment-repository.js';
import { RaceCatalog } from './race-repository.js';

export function buildSpellCatalogServer(databasePath: string, logger = true) {
  const app = Fastify({ logger });
  const catalog = new SpellCatalog(databasePath);
  const equipment = new EquipmentCatalog(databasePath);
  const races=new RaceCatalog(databasePath);
  app.addHook('onClose',async()=>races.close());
  app.get<{Querystring:{q?:string}}>('/api/spellbook/races',{schema:{querystring:{type:'object',additionalProperties:false,properties:{q:{type:'string',maxLength:200}}}}},async request=>races.list(request.query.q));
  app.get<{Params:{id:number};Querystring:{subrace?:number}}>('/api/spellbook/races/:id',{
    schema:{params:{type:'object',required:['id'],properties:{id:{type:'integer',minimum:1}}},querystring:{type:'object',additionalProperties:false,properties:{subrace:{type:'integer',minimum:1}}}},
  },async(request,reply)=>{try{return races.detail(request.params.id,request.query.subrace)??reply.code(404).send({message:'Раса не найдена.'});}catch(error){return reply.code(400).send({message:error instanceof Error?error.message:'Ошибка выбора расы.'});}});
  app.addHook('onClose', async () => catalog.close());
  app.addHook('onClose', async () => equipment.close());
  if(equipment.available){
    app.get('/api/spellbook/equipment/lookups',async()=>equipment.lookups());
    app.get<{Querystring:{q?:string;kind?:number;magic?:boolean;status?:string;source?:number}}>('/api/spellbook/equipment',{
      schema:{querystring:{type:'object',additionalProperties:false,properties:{q:{type:'string',maxLength:200},kind:{type:'integer',minimum:1},magic:{type:'boolean'},status:{type:'string',enum:['structured','partial']},source:{type:'integer',minimum:1}}}},
    },async(request)=>equipment.list(request.query));
    app.get<{Params:{id:number};Querystring:{base?:number;variant?:number}}>('/api/spellbook/equipment/:id',{
      schema:{params:{type:'object',required:['id'],properties:{id:{type:'integer',minimum:1}}},querystring:{type:'object',additionalProperties:false,properties:{base:{type:'integer',minimum:1},variant:{type:'integer',minimum:1}}}},
    },async(request,reply)=>{try{const item=equipment.detail(request.params.id,request.query.base,request.query.variant);return item??reply.code(404).send({message:'Предмет не найден.'});}catch(error){return reply.code(400).send({message:error instanceof Error?error.message:'Ошибка выбора.'});}});
  }
  app.get('/api/spellbook/health', async () => ({ status: 'ok', catalog: 'isolated', schemaVersion: '1.2' }));
  app.get('/api/spellbook/lookups', async () => catalog.lookups());
  app.get<{ Querystring: SpellFilters }>('/api/spellbook/spells', {
    schema: { querystring: { type: 'object', additionalProperties: false, properties: {
      q: { type: 'string', maxLength: 200 }, level: { type: 'integer', minimum: 0, maximum: 9 },
      school: { type: 'integer', minimum: 1 }, class: { type: 'integer', minimum: 1 },
      ritual: { type: 'boolean' }, concentration: { type: 'boolean' },
    } } },
  }, async (request) => catalog.list(request.query));
  app.get<{ Params: { id: number } }>('/api/spellbook/spells/:id', {
    schema: { params: { type: 'object', required: ['id'], properties: { id: { type: 'integer', minimum: 1 } } } },
  }, async (request, reply) => {
    const spell = catalog.detail(request.params.id);
    return spell ?? reply.code(404).send({ message: 'Заклинание не найдено.' });
  });
  return app;
}
