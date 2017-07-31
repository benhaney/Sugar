## Sugar

Sugar is a simple circuit simulator in the vein of SPICE but with support for linear networks only.

Given a netlist, Sugar will return the voltages at each node.

## Rationale

Sugar, at its core, is a collection of highly parallelizable matrix algorithms for accurately representing linear electrical components. Currently, component support is limited to resistors, DC current sources, DC voltage sources, and voltage controlled DC voltage sources. Support for capacitors and inductors in steady state can be added, but anything else that is a function of time will require an altogether different approach to solve.

While much more complete circuit simulation software exists, it is usually based on SPICE, which approaches all analysis with a time-slice approximation method. This approach is slow for networks that do not change with respect to time, and might be improved by applying the methods in this repository to nets or subnets that are not influenced by time.

## Operation

Say we have the circuit below, where nodes have been numbered:

![](https://git.benhaney.com/Ben/Sugar/raw/branch/master/img/circuit_01.png)

We create a netlist by listing each component, along with the nodes it connects to and its value. For example, the bottom left resistor (which we will call R1), will have a netlist entry of `["R1", 0, 1, 2]` because it is named R1, is connected to nodes 0 and 1, and has a value of 2 ohms.

All together, the resulting netlist is
```
[["R1", 0, 1, 2],
 ["R2", 0, 2, 3],
 ["V1", 1, 2, 5],
 ["I1", 0, 3, 4],
 ["R3", 2, 3, 5],
 ["R4", 3, 4, 3],
 ["I2", 1, 4, 2],
 ["R5", 2, 4, 4]]
```

We can feed this netlist directly as input to sugar (it will assume node 0 is ground), and in return it will print
```
[2.8, 7.8, 22.8, 19.8]
```
Which means that the voltage at node 1 is 2.8V, the voltage at node 2 is 7.8V, etc. The voltage at node 0 is of course always 0V, so it is not included in the output.

## Overview of Algorithms

Our goal is to reduce the circuit to a system of linear equations so we can solve them using normal matrix solving techniques.

For our starting environment, we create a coefficient matrix *m* with a size proportional to the number of nodes. A circuit with 3 non-ground nodes will result in a 3x3 *m* matrix.

We also create a column vector *b* of the same height.

### Resistors

*m* is modified by adding or subtracting the reciprocal of the resistor value from cells where the row and column indicies are both in the list made up of the two nodes the resistor connects.

For example, in a circuit with 3 non-ground nodes, a resistor of 2 ohms between nodes 2 and 3 would result in the following operation
```
     | 0   0    0  |
m += | 0  0.5 -0.5 |
     | 0 -0.5  0.5 |
```

### Current Sources

Current sources modify the column vector *b*. Their value is subtracted from the element in *b* corresponding to the node connected to their negative end, and added to the element corresponding to the node connected to their positive end.

For example, in a circuit with 3 non-ground nodes, a current source of 2 amps from node 2 to node 3 would result in the following operation
```
     |  0 |
b += | -2 |
     |  2 |
```

### Voltage Sources

Voltage sources do some tricky memory things and can't really be expressed as purely mathematical operations without abandoning the spirit of the implementation entirely. Given the two nodes they connect to, the row of *m* representing the second node is added to the first row. The second row is then entirely replaced with a relationship of the nodes. Then the pointer pointing to the second row is set to the address of the first row, so that all future operations applied to the second row are applied to the first row instead

As an example, let's say we're given the following matrices:
```
    | a b c |      | x |
m = | d e f |  b = | y |
    | g h i |      | z |
```
And we have a voltage source of 3V going from node 2 to node 3.

We first merge the rows and add the relationship row:
```
    |  a   b   c  |      |  x  |
m = | d+g e+h f+i |  b = | y+z |
    |  0  -1   1  |      |  3  |
```
And then we do some memory trickery to make all future operations see this

(the asterisks by the two rows indicate that the rows are backed by the same memory)
```
    |  a   b   c  |
m = | d+g e+h f+i | *
    | d+g e+h f+i | *
```
This is then reverted before solving takes place, revealing the untouched node relationship equation in the third row
