import { authenticated, coachOnly } from '@/features/programs/access';
import { ensure } from '@/features/programs/definition';
import { response, sameOrigin } from '@/features/programs/http';
import {
  archiveProgram,
  assignProgram,
  choices,
  details,
  duplicateProgram,
  programList,
  saveProgram,
} from '@/features/programs/repository';

export async function GET(req: Request) {
  return response(async () => {
    const actor = await authenticated();
    coachOnly(actor);
    const params = new URL(req.url).searchParams;
    if (params.has('choices')) return choices(actor, params.get('choices')!);
    if (params.has('id')) return details(actor, params.get('id')!);
    return programList(actor, params);
  });
}
export async function POST(req: Request) {
  return response(async () => {
    sameOrigin(req);
    const actor = await authenticated();
    coachOnly(actor);
    const data = await req.json();
    ensure(data && typeof data === 'object', 'اطلاعات درخواست معتبر نیست.');
    if (data.intent === 'save') {
      ensure(data.id === undefined || typeof data.id === 'string', 'شناسهٔ قالب نامعتبر است.');
      return saveProgram(actor, data.definition, data.status, data.id, data.revision);
    }
    ensure(typeof data.id === 'string' && data.id.length > 0, 'برنامه را انتخاب کنید.');
    if (data.intent === 'duplicate') return duplicateProgram(actor, data.id);
    ensure(Number.isSafeInteger(data.revision), 'نسخهٔ برنامه نامعتبر است.');
    if (data.intent === 'archive') return archiveProgram(actor, data.id, data.revision);
    ensure(data.intent === 'assign', 'عملیات معتبر نیست.');
    return assignProgram(actor, data.id, data.revision, data.requestId, data.recipients);
  });
}
