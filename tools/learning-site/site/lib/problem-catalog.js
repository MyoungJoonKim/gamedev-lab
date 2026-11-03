import {problems} from './data.js';
import {generatedProblem} from './daily-problems.js';
export const getProblem=id=>problems.find(p=>p.id===id)||generatedProblem(id);
