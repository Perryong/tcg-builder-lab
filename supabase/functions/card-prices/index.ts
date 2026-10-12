import {handleCardPrices} from './handler.ts';

Deno.serve(request => handleCardPrices(request));
