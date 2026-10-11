import { getServerUser } from '../../lib/authServer';
import results from '../../lib/sportsbookResults.cjs';
import { interpretQuestion } from '../../lib/betQuestion.mjs';

export default results.createHandler({ getUser: getServerUser, interpretQuestion });
export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
