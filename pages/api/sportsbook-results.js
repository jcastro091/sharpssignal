import { getServerUser } from '../../lib/authServer';
import results from '../../lib/sportsbookResults.cjs';

export default results.createHandler({ getUser: getServerUser });
export const config = { api: { bodyParser: { sizeLimit: '4kb' } } };
