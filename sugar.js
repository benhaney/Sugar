#!/usr/bin/env node

const lin = require('numberic')
const fs  = require('fs')

if (process.argv.length < 3) {
  console.error('No input file given')
  process.exit()
}
fs.readFile(process.argv[2], function(err, data) {
  simulate(JSON.parse(data))
})

function simulate(ckt) {
	//Determine size of matrix from largest node in input
  let size = ckt.map(a=>a[1]).concat(ckt.map(a=>a[2])).sort().reverse()[0]
	//Create matrix m. Initialize all values to 0
  let m = [...Array(size)].map(()=>[...Array(size)].map(()=>[0]))
	//Create solution matrix b. Initialize to 0s
  let b = [...Array(size)].map(()=>[0])
	//Index array (n): Used to access m. modified for supernoding.
	//create n of form [0,1,2,...,m.length-1]
	let n = m.reduce((a,b,c) => a.concat([[c]]), [])
	//Start processing components
  for (let comp of ckt) {
    if (comp[1] == 0 && comp[2] == 0) { continue }
    // Processing a resistor
    if (comp[0].slice(0,1) == 'R') {
      let io  = comp.slice(1,3)
      let val = comp[3]
      if (io[0] != 0) {
        m[n[io[0]-1][0]][io[0]-1][0] += 1/val
				if (io[1] != 0) {
					m[n[io[0]-1][0]][io[1]-1][0] -= 1/val
        }
      }
      if (io[1] != 0) {
        m[n[io[1]-1][0]][io[1]-1][0] += 1/val
				if (io[0] != 0) {
					m[n[io[1]-1][0]][io[0]-1][0] -= 1/val
        }
      }
    // Processing a current source
    } else if (comp[0].slice(0,1) == 'I') {
      let io  = comp.slice(1,3)
      let val = comp[3]
			if (io[0] != 0) { b[n[io[0]-1][0]][0] -= val }
			if (io[1] != 0) { b[n[io[1]-1][0]][0] += val }
    // Processing a voltage source
    } else if (comp[0].slice(0,1) == 'V') {
      let io  = comp.slice(1,3)
      let val = comp[3]
      // Add both rows into first row (now supernode)
			for (let i in m[n[io[0]-1][0]]) {
				m[n[io[0]-1][0]][i][0] += m[n[io[1]-1][0]][i][0]
			}
			b[n[io[0]-1][0]][0] += b[n[io[1]-1][0]][0]
      // Replace second row with node relationship equation
			m[n[io[1]-1][0]] = [...Array(size++)].map(()=>[0])
			m[n[io[1]-1][0]][io[0]-1][0] = -1
			m[n[io[1]-1][0]][io[1]-1][0] = 1
      b[n[io[1]-1][0]][0] = val
      // Modified behavior for voltage controlled voltage sources
			if (comp[0].slice(1,2) == 'c') {
				let gio = comp.slice(4,6)
				if (gio[0] != 0) m[n[io[1]-1][0]][gio[0]-1][0] += val
				if (gio[1] != 0) m[n[io[1]-1][0]][gio[1]-1][0] -= val
				b[n[io[1]-1][0]][0] = 0
      }
      // Modify index array so both applicable row indices point to our supernode
			// i.e. supernoding row 1 and 3 causes n = [0,1,2,3] -> n = [0,1,2,1]
			n[io[1]-1] = n[io[0]-1]
    }
  }
  const nodeV = lin.solve(m,b)
  console.log(lin.prettyPrint(nodeV))
}
