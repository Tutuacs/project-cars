import * as fs from 'fs';
import * as readline from 'readline';

type TotaisPorMarca = {
  ilesos: number;
  feridos_leves: number;
  feridos_graves: number;
  mortos: number;
  totalValue?: number;
  countValues?: number;
  averageValue?: number;
};

const mapaMarcas = new Map<string, TotaisPorMarca>();

// 1) Acidentes
async function processarAcidentes(caminho: string) {
  const stream = fs.createReadStream(caminho, 'utf-8');
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let isFirst = true;

  for await (const line of rl) {
    if (isFirst) { isFirst = false; continue; }
    const campos = line.split(';').map(c => c.replace(/(^"|"$)/g, ''));

    // corrige colunas, se precisar
    if (parseInt(campos[21]) > 0) {
      campos[21] = campos[20];
      campos[27] = campos[26];
      campos[28] = campos[27];
      campos[29] = campos[28];
      campos[30] = campos[29];
      campos[31] = campos[30];
    }

    const rawMarca = campos[21] || 'DESCONHECIDA';      // ex: 'SCANIA/R500 A6X4'
    const marca = rawMarca.toUpperCase();
    const ilesos        = parseInt(campos[27]) || 0;
    const ferLeves      = parseInt(campos[28]) || 0;
    const ferGraves     = parseInt(campos[29]) || 0;
    const mortos        = parseInt(campos[30]) || 0;

    if (!mapaMarcas.has(marca)) {
      mapaMarcas.set(marca, { ilesos: 0, feridos_leves: 0, feridos_graves: 0, mortos: 0 });
    }
    const tot = mapaMarcas.get(marca)!;
    tot.ilesos         += ilesos;
    tot.feridos_leves  += ferLeves;
    tot.feridos_graves += ferGraves;
    tot.mortos         += mortos;
  }
}

// 2) Vendas de carros
async function processarVendas(caminho: string) {
  const vendaMap = new Map<string, { sum: number; count: number }>();
  const stream = fs.createReadStream(caminho, 'utf-8');
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let isFirst = true;

  for await (const line of rl) {
    if (isFirst) { isFirst = false; continue; }
    const [ rawName, , priceStr ] = line.split(',');
    const name = rawName.trim().toUpperCase();   // TUDO em maiúsculo!
    const price = parseFloat(priceStr);
    if (isNaN(price)) continue;

    if (!vendaMap.has(name)) {
      vendaMap.set(name, { sum: 0, count: 0 });
    }
    const acc = vendaMap.get(name)!;
    acc.sum   += price;
    acc.count += 1;
  }
  return vendaMap;
}

// 3) Junta tudo
async function main() {
  await processarAcidentes('./acidentes2025.csv');
  const vendaMap = await processarVendas('./cars.csv');

  const mapaFiltrado = new Map<string, TotaisPorMarca>();

  for (const [rawMarca, totais] of mapaMarcas.entries()) {
    const [brandAcc, modelAcc] = rawMarca.split('/').map(s => s.trim().toUpperCase());

    for (const [carName, acc] of vendaMap.entries()) {
      if (modelAcc && carName.includes(modelAcc)) {
        totais.totalValue   = acc.sum;
        totais.countValues  = acc.count;
        totais.averageValue = acc.count > 0 ? acc.sum / acc.count : 0;

        mapaFiltrado.set(rawMarca, totais); // Adiciona só se encontrar correspondência
        break;
      }
    }
  }

  const resultado = Object.fromEntries(mapaFiltrado);
  fs.writeFileSync('resultado_only_model_completo.json', JSON.stringify(resultado, null, 2), 'utf-8');
  console.log('✔ resultado_model_completo.json gerado!');
}


main().catch(console.error);
