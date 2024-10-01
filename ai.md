# The Case for Using Rule-Based Systems for AI Agents

In order to actually automate processes, the system can’t hallucinate, and must follow explainable practices.
One way to do that is to combine [LLM](https://en.wikipedia.org/wiki/Large_language_model) and [Symbolic AI](https://en.wikipedia.org/wiki/Symbolic_artificial_intelligence).

Several different techniques have been developed for Symbolic AI. One of these involves a set of computer science techniques used in the implementation of spreadsheets. 

Spreadsheets are a bit under-appreciated. The superpower of a spreadsheet is that an in-house domain expert creates the simple formula for each cell, but the spreadsheet software handles the complex programming:
1. The software automatically figures out what other cells need to be computed, in what order, to evaluate a formula.
2. If you change something, the software automatically figures out what needs to be recomputed to keep things right.

As a result, the formula (company rules) can be:
- developed incrementally over time, with full utility along the way.
- combined from different parts (e.g., different sheets) developed by different people.
- interactively explored in what-if scenarios, in which someone can see the effects of changing input parameters.
- drilled into, to see exactly how a particular value is being computed.

Now, suppose we combined an LLM with this. For example, [TechCrunch](https://techcrunch.com/2024/07/09/alexa-co-creator-gives-first-glimpse-of-unlikely-ais-tech-strategy/) suggested that on e might  "...combine the certainties of traditional software, such as spreadsheets, where the calculations are 100% accurate, with the “neuro” approach in generative AI." Perhaps:
1. The LLM runs wherever (e.g., at the big-iron AI vendor) and gives answers that might be wrong, and in any case don’t follow a particular company’s rules for what to do with that data.
2. This populates some of the raw input data in the rules. (Maybe it's presented in a spreadsheet-like way. Maybe not.)
3. The sheets sanity-check the results based on in-house rules, and determine the company-specific results.
4. Some of the outputs are actual results, such as a printable purchase/change-order, or CLI-able AWS foo for an internal operational change,  etc.
5. Unlike a spreadsheet, these can actually DO something, such as sending the PO, or scaling up the cloud instances on some infrastructure.

The problem is that spreadsheets don’t scale:
- A single application might have thousands of little formula, from people all throughout an orgnization.
- Spreadsheets are tough to organize (e.g., as objects with inheritance)
- Spreadsheets are clunky and limited in their integration with other systems.

However, the underlying techniques can be scalable. The present author was an engineer with a rule-based expert systems company in the 1980's that handled 10s of thousands of forumalae on the hardware of the time. 
- The ICAD system was used for designing aircraft and automobile systems, satelities, oil drilling platforms, high-tension lines, power transformers, nuclear reactors, and the like.  Engineers would write out the rules for a system - e.g., how does a wiring harness get designed -- and then design teams would apply it to various scenarios. They would then have it generate technical drawings, bills of material, and such for the winning design.
- This led to several spinoffs and acquisitions. For example, one spinoff was aimed at sales configurations and acquired by Oracle, while another was rewritten for PCs and used to configure custom equipment and buildings, and was acquired by Autodesk.
The limiting factor was primarily memory, which is vastly more abundant now.

[The current repo](./) is a Javascript version that runs in browsers and in NodeJS. The code does not include a UI, and does not have to be presented like a spreadsheet. In fact, it can be used directly as ordinary Javascript, using normal software-development lifecycle techniques:

```
import { Rule } from '@ki1r0y/rules';

class Box {
  get length() {  // The simplest rule just returns a value.
    return 2;
  }
  get width() {
    return 3 * this.length; // A formula that depends on other Rules.
  }
  get area() {
    return this.length * this.width; // Multiple other rules.
  }
}
Rule.rulify(Box.prototype);  // Converts the "get" methods to Rules.

var box = new Box();
console.log(box.length); // 2
console.log(box.area);   // 12    After automatically computing width.
console.log(box.width);  // 6     The value computed for width is cached.

box.length = 5;          //       The "set" method was automatically generated.
console.log(box.area);   // 75!   Width and area were both recomputed.
box.width = 3;
console.log(box.area);   // 15    We have overriden the formula, and area has been recalculated.
```

Under the hood, the rule system is [memoized, demand-driven, dependency-directed backtracking supporting asynchronous evaluation](README.md). But you can think of it as "working like a spreadsheet."
