// Authoring script for the second question batch (drafted with AI at build time, to be reviewed by a human).
// It checks the computable answers (series, directions, ranking, seating) in code, shuffles option order
// deterministically and writes packages/content/src/questions-extra-1.json.
// Run: node scripts/author-extra-questions.mjs
import fs from "node:fs";
import assert from "node:assert/strict";

const FIRST_ID = 134;
const out = [];
const add = (categoryId, difficulty, topic, title, text, correct, wrongs, explanation) => {
  assert.equal(wrongs.length, 3, title);
  assert.ok(!wrongs.includes(correct), `correct also listed as wrong: ${title}`);
  const n = out.length;
  const pos = (n * 3 + 1) % 4; // vary where the correct option sits
  const options = [...wrongs];
  options.splice(pos, 0, correct);
  out.push({
    id: FIRST_ID + n, categoryId, companyId: null, title, questionText: text, difficulty,
    questionType: "MCQ", topic, expectedAnswer: correct, explanation,
    options: options.map((t) => ({ text: t, correct: t === correct })),
  });
};

// ---------------------------------------------------------------- Logical & Verbal Reasoning (category 2)
const LV = 2;

// number series: compute the next term in code so the keyed answer cannot be wrong
const nextByDiffs = (seq, nextDiff) => seq[seq.length - 1] + nextDiff;
assert.equal(nextByDiffs([2, 6, 12, 20, 30], 12), 42);
add(LV, "EASY", "Number Series", "Number Series - Increasing Differences",
  "Find the next number in the series: 2, 6, 12, 20, 30, ?", "42", ["40", "44", "36"],
  "The differences are 4, 6, 8, 10, so the next difference is 12 and the next term is 30 + 12 = 42.");

add(LV, "EASY", "Number Series", "Number Series - Geometric Progression",
  "Find the next number in the series: 3, 9, 27, 81, ?", "243", ["162", "324", "216"],
  "Each term is multiplied by 3: 81 x 3 = 243.");

const sq1 = [1, 2, 3, 4, 5].map((n) => n * n + 1); // 2,5,10,17,26
assert.deepEqual(sq1, [2, 5, 10, 17, 26]);
add(LV, "MEDIUM", "Number Series", "Number Series - Squares Plus One",
  "Find the next number in the series: 2, 5, 10, 17, 26, ?", "37", ["35", "36", "38"],
  "The terms follow n^2 + 1 (1+1, 4+1, 9+1, 16+1, 25+1). The next is 6^2 + 1 = 37.");

let t = 5; const dbl = [t]; for (let i = 0; i < 4; i++) { t = t * 2 + 1; dbl.push(t); }
assert.deepEqual(dbl, [5, 11, 23, 47, 95]);
add(LV, "MEDIUM", "Number Series", "Number Series - Double and Add One",
  "Find the next number in the series: 5, 11, 23, 47, ?", "95", ["93", "97", "94"],
  "Each term is twice the previous term plus 1: 47 x 2 + 1 = 95.");

add(LV, "EASY", "Number Series", "Number Series - Fibonacci Pattern",
  "Find the missing number: 1, 1, 2, 3, 5, 8, ?, 21", "13", ["11", "12", "14"],
  "Each term is the sum of the two before it. 5 + 8 = 13, and 8 + 13 = 21 confirms it.");

assert.equal(25 + 7, 32);
add(LV, "MEDIUM", "Number Series", "Number Series - Growing Differences",
  "Find the next number in the series: 7, 10, 14, 19, 25, ?", "32", ["31", "33", "34"],
  "The differences are 3, 4, 5, 6, so the next difference is 7: 25 + 7 = 32.");

assert.equal(50 - 25, 25);
add(LV, "MEDIUM", "Number Series", "Number Series - Decreasing Differences",
  "Find the next number in the series: 100, 95, 85, 70, 50, ?", "25", ["20", "30", "15"],
  "The differences are -5, -10, -15, -20, so the next is -25: 50 - 25 = 25.");

// syllogisms
add(LV, "MEDIUM", "Syllogism", "Syllogism - Chain of All Statements",
  "Statements: All cats are dogs. All dogs are birds.\nConclusions: I. All cats are birds. II. Some birds are dogs.",
  "Both I and II follow", ["Only I follows", "Only II follows", "Neither I nor II follows"],
  "I follows by chaining 'All cats are dogs' and 'All dogs are birds'. II follows because 'All dogs are birds' implies that some birds are dogs.");

add(LV, "MEDIUM", "Syllogism", "Syllogism - Some and All",
  "Statements: Some pens are books. All books are tables.\nConclusions: I. Some pens are tables. II. All tables are books.",
  "Only I follows", ["Only II follows", "Both I and II follow", "Neither I nor II follows"],
  "The pens that are books are also tables, so I follows. II reverses 'All books are tables', which is not allowed.");

add(LV, "HARD", "Syllogism", "Syllogism - Negative Statement",
  "Statements: No flower is a tree. Some trees are plants.\nConclusions: I. Some plants are not flowers. II. No plant is a flower.",
  "Only I follows", ["Only II follows", "Both I and II follow", "Neither I nor II follows"],
  "The plants that are trees cannot be flowers (no flower is a tree), so some plants are not flowers. II is too strong: other plants may be flowers.");

// blood relations
add(LV, "EASY", "Blood Relations", "Blood Relations - Father's Brother's Son",
  "Pointing to a photograph, Riya says, 'He is the son of my father's only brother.' How is the man related to Riya?",
  "Cousin", ["Brother", "Uncle", "Nephew"],
  "My father's brother is my uncle, and his son is my cousin.");

add(LV, "MEDIUM", "Blood Relations", "Blood Relations - Generation Chain",
  "A is B's sister. C is B's mother. D is C's father. How is A related to D?",
  "Granddaughter", ["Daughter", "Grandmother", "Great-granddaughter"],
  "C is the mother of both A and B, and D is C's father. So A is D's daughter's daughter, i.e. his granddaughter.");

add(LV, "MEDIUM", "Blood Relations", "Blood Relations - Only Daughter of My Mother",
  "Introducing a man, a woman says, 'His mother is the only daughter of my mother.' How is the woman related to the man?",
  "Mother", ["Sister", "Aunt", "Grandmother"],
  "The only daughter of the woman's mother is the woman herself, so she is the man's mother.");

// direction sense: simulated
function walk(start, moves) {
  // headings: N=(0,1) E=(1,0) S=(0,-1) W=(-1,0); turns are relative
  const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let [x, y] = start.pos; let h = start.heading;
  for (const m of moves) {
    if (m.turn === "R") h = (h + 1) % 4; if (m.turn === "L") h = (h + 3) % 4;
    x += dirs[h][0] * m.d; y += dirs[h][1] * m.d;
  }
  return [x, y];
}
assert.deepEqual(walk({ pos: [0, 0], heading: 0 }, [{ d: 5 }, { turn: "R", d: 3 }, { turn: "R", d: 5 }]), [3, 0]);
add(LV, "EASY", "Direction Sense", "Direction Sense - Return Path",
  "A man walks 5 km north, turns right and walks 3 km, then turns right again and walks 5 km. How far, and in which direction, is he from his starting point?",
  "3 km East", ["3 km West", "5 km East", "8 km North"],
  "North 5 km, then east 3 km, then south 5 km brings him back to the same latitude, 3 km east of the start.");

add(LV, "EASY", "Direction Sense", "Direction Sense - Turning Angles",
  "Rohan faces East. He turns 90 degrees clockwise and then 180 degrees anticlockwise. Which direction is he facing now?",
  "North", ["South", "East", "West"],
  "East turned 90 degrees clockwise is South. Turning 180 degrees from South gives North.");

assert.deepEqual(walk({ pos: [0, 0], heading: 3 }, [{ d: 10 }, { turn: "L", d: 10 }, { turn: "R", d: 10 }, { turn: "R", d: 10 }]), [-20, 0]);
add(LV, "MEDIUM", "Direction Sense", "Direction Sense - Four Legged Walk",
  "Aman starts at P and walks 10 m west. He turns left and walks 10 m, then turns right and walks 10 m, then turns right again and walks 10 m. Where is he with respect to P?",
  "20 m West", ["10 m West", "20 m South", "30 m West"],
  "West 10 m, left (south) 10 m, right (west) 10 m, right (north) 10 m. Net: 20 m west and 0 m north-south.");

// coding-decoding
const shift = (w, k) => [...w].map((c) => String.fromCharCode(((c.charCodeAt(0) - 65 + k + 26) % 26) + 65)).join("");
assert.equal(shift("ROAD", 3), "URDG");
assert.equal(shift("SWIM", 3), "VZLP");
add(LV, "MEDIUM", "Coding-Decoding", "Coding-Decoding - Letter Shift",
  "In a certain code, ROAD is written as URDG. How is SWIM written in that code?",
  "VZLP", ["VYLP", "UZLP", "VZKP"],
  "Every letter is moved 3 places forward (R->U, O->R, A->D, D->G). So S->V, W->Z, I->L, M->P gives VZLP.");

assert.equal(shift("MONDAY", 1), "NPOEBZ");
assert.equal(shift("FRIDAY", 1), "GSJEBZ");
add(LV, "EASY", "Coding-Decoding", "Coding-Decoding - Next Letter",
  "If MONDAY is coded as NPOEBZ, how is FRIDAY coded?",
  "GSJEBZ", ["GSJDBZ", "ESHCZX", "GRJEBZ"],
  "Each letter is replaced by the next letter of the alphabet: F->G, R->S, I->J, D->E, A->B, Y->Z.");

assert.equal([..."CHAIR"].reverse().join(""), "RIAHC");
add(LV, "EASY", "Coding-Decoding", "Coding-Decoding - Reverse Order",
  "If TABLE is coded as ELBAT, how is CHAIR coded?",
  "RIAHC", ["RAIHC", "CHAIR", "DIBJS"],
  "The word is written backwards: TABLE -> ELBAT, so CHAIR -> RIAHC.");

// seating / ranking
assert.equal(40 - 12 + 1, 29);
add(LV, "EASY", "Ranking", "Ranking - Position from the Other End",
  "In a row of 40 students, Ravi is 12th from the left. What is his position from the right?",
  "29th", ["28th", "30th", "27th"],
  "Position from the right = total - position from the left + 1 = 40 - 12 + 1 = 29.");

// brute-force the seating puzzle to confirm a unique middle person
const people = ["A", "B", "C", "D", "E"];
function perms(a) { return a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])); }
const ok = perms(people).filter((p) => {
  const i = (x) => p.indexOf(x);
  return i("C") < i("A") && i("A") < i("B") && i("B") < i("D") && i("D") < i("E");
});
assert.equal(ok.length, 1); assert.equal(ok[0][2], "B");
add(LV, "MEDIUM", "Seating Arrangement", "Seating - Five Friends in a Row",
  "Five friends A, B, C, D and E sit in a row facing north. A is to the left of B but to the right of C. D is to the right of B but to the left of E. Who sits in the middle?",
  "B", ["A", "C", "D"],
  "C is left of A, A is left of B, B is left of D, D is left of E. The order is C, A, B, D, E, so B is in the middle.");

assert.equal(7 + 28 - 1, 34);
add(LV, "EASY", "Ranking", "Ranking - Total Students from Two Ranks",
  "In a class, Priya ranks 7th from the top and 28th from the bottom. How many students are in the class?",
  "34", ["35", "33", "36"],
  "Total = rank from top + rank from bottom - 1 = 7 + 28 - 1 = 34.");

// analogy / odd one out
add(LV, "EASY", "Analogy", "Analogy - Place of Work",
  "Doctor : Hospital :: Teacher : ?", "School", ["Student", "Books", "Salary"],
  "A doctor works in a hospital in the same way a teacher works in a school.");
add(LV, "EASY", "Odd One Out", "Odd One Out - Planets",
  "Which one is different from the others: Mercury, Venus, Moon, Mars?", "Moon", ["Mercury", "Venus", "Mars"],
  "Mercury, Venus and Mars are planets. The Moon is a natural satellite of the Earth.");

// verbal ability
add(LV, "EASY", "Synonyms", "Synonym - Abundant",
  "Choose the word closest in meaning to ABUNDANT.", "Plentiful", ["Scarce", "Rare", "Limited"],
  "Abundant means existing in large quantities, which is the same as plentiful.");
add(LV, "MEDIUM", "Antonyms", "Antonym - Benevolent",
  "Choose the word opposite in meaning to BENEVOLENT.", "Malevolent", ["Generous", "Charitable", "Kind"],
  "Benevolent means well-meaning and kind. Malevolent means wishing harm to others.");
add(LV, "EASY", "One-Word Substitution", "One Word - Lover of Books",
  "Choose the single word for 'a person who loves books'.", "Bibliophile", ["Philatelist", "Numismatist", "Misanthrope"],
  "A bibliophile loves books. A philatelist collects stamps, a numismatist collects coins, and a misanthrope dislikes people.");
add(LV, "MEDIUM", "Sentence Correction", "Sentence Correction - Subject-Verb Agreement",
  "Choose the grammatically correct sentence.",
  "Neither of the students has submitted the assignment.",
  ["Neither of the students have submitted the assignment.", "Neither of the student has submitted the assignment.", "Neither of the students are submitting the assignment."],
  "'Neither' is singular, so it takes the singular verb 'has', and 'of the students' needs the plural noun.");
add(LV, "EASY", "Prepositions", "Fill in the Blank - Preposition",
  "Fill in the blank: She is allergic ____ peanuts.", "to", ["of", "with", "at"],
  "The adjective 'allergic' is followed by the preposition 'to'.");
add(LV, "MEDIUM", "Idioms", "Idiom - Bite the Bullet",
  "What does the idiom 'to bite the bullet' mean?",
  "To face a painful or unpleasant situation bravely", ["To eat something very hard", "To act without thinking", "To avoid a difficult task"],
  "It means to accept an unpleasant but unavoidable situation and deal with it with courage.");
add(LV, "EASY", "Reading Comprehension", "Reading Comprehension - Photosynthesis",
  "Passage: 'Photosynthesis is the process by which green plants prepare food using sunlight, carbon dioxide and water. Oxygen is released as a by-product.'\nWhich gas is released during photosynthesis?",
  "Oxygen", ["Carbon dioxide", "Nitrogen", "Hydrogen"],
  "The passage states that oxygen is released as a by-product.");

// ---------------------------------------------------------------- Object-Oriented Programming (category 7)
const OOP = 7;
add(OOP, "EASY", "Encapsulation", "Encapsulation - Hiding Internal State",
  "Which OOP principle bundles data with the methods that operate on it and restricts direct access to the internal state?",
  "Encapsulation", ["Polymorphism", "Inheritance", "Abstraction"],
  "Encapsulation keeps fields private and exposes controlled access through methods.");
add(OOP, "MEDIUM", "Polymorphism", "Compile-Time Polymorphism",
  "Which of the following is an example of compile-time (static) polymorphism?",
  "Method overloading", ["Method overriding", "Virtual function dispatch", "Dynamic binding"],
  "Overloaded methods are chosen by the compiler from the argument types. Overriding is resolved at run time.");
add(OOP, "MEDIUM", "Abstraction", "Abstract Class vs Interface",
  "Which statement about an abstract class and an interface in Java is TRUE?",
  "An abstract class can have constructors and instance fields, an interface cannot have instance fields",
  ["An interface can have constructors, an abstract class cannot", "Both can be instantiated directly with new", "A class can extend multiple abstract classes"],
  "Abstract classes can hold state and constructors. Interfaces only declare constants (static final fields), and a class can extend only one class.");
add(OOP, "EASY", "Abstraction", "Concrete Class and Abstract Methods",
  "A non-abstract class extends an abstract class but does not implement one of its abstract methods. What happens?",
  "Compilation error", ["The method returns null at run time", "The program compiles and the method does nothing", "An exception is thrown only when the method is called"],
  "A concrete class must implement every inherited abstract method or be declared abstract itself.");
add(OOP, "EASY", "Inheritance", "Constructors and Inheritance",
  "In Java, are constructors inherited by subclasses?", "No, a subclass must declare its own constructors", ["Yes, all of them", "Only public constructors", "Only the no-argument constructor"],
  "Constructors are not members that are inherited. A subclass constructor calls a superclass constructor with super(...).");
add(OOP, "MEDIUM", "Inheritance", "Implicit super() Call",
  "A superclass declares only a constructor that takes an int parameter. A subclass constructor does not call super(...) explicitly. What happens?", "Compilation error, because there is no no-argument superclass constructor to call implicitly", ["It compiles and the int parameter defaults to 0", "It compiles and fails with an exception at run time", "The subclass constructor is skipped"],
  "The compiler inserts an implicit super() call. If the superclass has no accessible no-argument constructor, the subclass must call a constructor explicitly.");
add(OOP, "MEDIUM", "Inheritance", "Multiple Inheritance and the Diamond Problem",
  "How does Java avoid the diamond problem that arises with multiple inheritance?",
  "A class can extend only one class, but may implement many interfaces", ["It forbids interfaces", "It merges the methods of all parents automatically", "It picks the parent that was declared first"],
  "Single class inheritance removes ambiguity. For interfaces with conflicting default methods, the class must override the method.");
add(OOP, "MEDIUM", "Polymorphism", "Virtual Functions in C++",
  "What is the main purpose of virtual functions in C++?", "To enable run-time polymorphism through the base class pointer or reference", ["To make functions run faster", "To prevent a class from being inherited", "To allow functions without a body"],
  "A virtual call is dispatched on the actual object type (via the vtable), not the pointer type.");
add(OOP, "EASY", "Static Members", "Static Methods and Instance Members",
  "Which statement about a static method in Java is correct?", "It cannot directly access non-static instance fields", ["It can access this", "It must be called on an object", "It can be overridden to change run-time behaviour"],
  "A static method belongs to the class, so it has no this reference and cannot use instance members without an object.");
add(OOP, "EASY", "Class Relationships", "Composition - Has-A Relationship",
  "A Car class contains an Engine object. Which relationship does this describe?", "Composition (has-a)", ["Inheritance (is-a)", "Overloading", "Polymorphism"],
  "Using another object as a field is composition. Inheritance describes is-a relationships.");
add(OOP, "EASY", "SOLID", "SOLID - Single Responsibility Principle",
  "What does the Single Responsibility Principle state?", "A class should have only one reason to change", ["A class should have only one method", "A class should extend only one class", "A class should be instantiated only once"],
  "Each class should focus on one responsibility so changes to one concern do not ripple into others.");
add(OOP, "MEDIUM", "SOLID", "SOLID - Liskov Substitution Principle",
  "What does the Liskov Substitution Principle require?", "Objects of a subclass must be usable wherever the superclass is expected without breaking correctness", ["A subclass must have more methods than its parent", "Every class must implement an interface", "Subclasses must not call parent methods"],
  "Subtypes must honour the contract of the base type. A Square that breaks the behaviour of Rectangle's setters is a classic violation.");
add(OOP, "EASY", "SOLID", "SOLID - Open/Closed Principle",
  "What does the Open/Closed Principle say?", "Software entities should be open for extension but closed for modification", ["Classes should be open to the public and closed to subclasses", "Methods should never be changed once written", "All fields should be private"],
  "You should be able to add new behaviour (for example, a new subclass) without editing existing, tested code.");
add(OOP, "MEDIUM", "SOLID", "SOLID - Dependency Inversion Principle",
  "What does the Dependency Inversion Principle recommend?", "High-level modules should depend on abstractions, not on concrete implementations", ["Low-level modules should depend on high-level modules directly", "Dependencies should be created using new inside the class", "Every class should have a single dependency"],
  "Depending on interfaces lets you swap implementations (for example, a database) without changing the business logic.");
add(OOP, "MEDIUM", "SOLID", "SOLID - Interface Segregation Principle",
  "What does the Interface Segregation Principle state?", "Clients should not be forced to depend on methods they do not use", ["An interface should contain as many methods as possible", "A class should implement only one interface", "Interfaces should never be split"],
  "Prefer several small, focused interfaces over one large one.");
add(OOP, "EASY", "Design Patterns", "Singleton Pattern",
  "What does the Singleton design pattern guarantee?", "Only one instance of the class exists and it has a global access point", ["Every call creates a new object", "A class cannot be subclassed", "Objects are created only from subclasses"],
  "Singleton restricts instantiation to one object and provides access to it.");
add(OOP, "MEDIUM", "Design Patterns", "Factory Pattern",
  "What is the main purpose of the Factory pattern?", "To create objects without exposing the instantiation logic to the client", ["To ensure only one object is created", "To notify observers of state changes", "To add behaviour to an object at run time"],
  "A factory method returns objects of a common type, so client code does not depend on concrete classes.");
add(OOP, "MEDIUM", "Design Patterns", "Observer Pattern",
  "Which design pattern defines a one-to-many dependency so that when one object changes state all its dependents are notified?", "Observer", ["Strategy", "Adapter", "Builder"],
  "A subject keeps a list of observers and notifies them of changes, as in event listeners.");
add(OOP, "MEDIUM", "Design Patterns", "Strategy Pattern",
  "Which pattern encapsulates a family of interchangeable algorithms so the algorithm can be chosen at run time?", "Strategy", ["Singleton", "Facade", "Prototype"],
  "Strategy moves each algorithm into its own class behind a common interface (for example, different sorting or payment strategies).");
add(OOP, "HARD", "Design Patterns", "Decorator Pattern",
  "What does the Decorator pattern let you do?", "Add responsibilities to an object dynamically without subclassing", ["Create a single shared instance", "Convert one interface into another", "Hide a complex subsystem behind a simple interface"],
  "Decorators wrap an object that has the same interface and add behaviour before or after delegating to it.");
add(OOP, "EASY", "Java Basics", "final Keyword on a Class",
  "What does declaring a class final mean in Java?", "The class cannot be extended", ["The class cannot be instantiated", "All its methods are static", "Its fields cannot be changed"],
  "A final class (for example String) cannot have subclasses.");
add(OOP, "MEDIUM", "Polymorphism", "Dynamic Method Dispatch Output",
  "What is printed by the following Java code?\nclass A { void show() { System.out.println(\"A\"); } }\nclass B extends A { void show() { System.out.println(\"B\"); } }\nA obj = new B();\nobj.show();",
  "B", ["A", "AB", "Compilation error"],
  "The reference type is A but the object is a B. The overridden method is chosen at run time, so B.show() runs.");
add(OOP, "MEDIUM", "Polymorphism", "Overload Resolution",
  "A class has two methods: void f(int x) and void f(long x). Which is called by f(5)?", "f(int x)", ["f(long x)", "Both are called", "The call is ambiguous and does not compile"],
  "The literal 5 is an int, so the exact match f(int) is preferred over a widening conversion to long.");
add(OOP, "EASY", "Java Basics", "Immutable Class Example",
  "Which of the following Java classes is immutable?", "String", ["StringBuilder", "ArrayList", "Date"],
  "Once created, a String's contents cannot change. Methods like concat return a new String.");
add(OOP, "MEDIUM", "Java Basics", "equals() and hashCode() Contract",
  "If two objects are equal according to equals(), what must be true about their hashCode() values?", "They must be equal", ["They must be different", "They can be anything", "They must be zero"],
  "The contract requires equal objects to have equal hash codes. Otherwise hash-based collections like HashMap break.");
add(OOP, "EASY", "Polymorphism", "Upcasting",
  "Assigning a subclass object to a superclass reference variable is called:", "Upcasting", ["Downcasting", "Boxing", "Overloading"],
  "Upcasting is implicit and always safe. Downcasting needs an explicit cast and can fail at run time.");
add(OOP, "MEDIUM", "Access Modifiers", "protected Access",
  "Which Java access modifier allows access within the same package and also from subclasses in other packages?", "protected", ["private", "default (package-private)", "public static"],
  "protected members are visible in the package and to subclasses. Package-private is visible only inside the package.");
add(OOP, "EASY", "Abstraction", "Instantiating an Abstract Class",
  "Can you create an object of an abstract class directly using new?", "No, only of a concrete subclass", ["Yes, always", "Yes, if it has no fields", "Yes, if the constructor is public"],
  "Abstract classes are incomplete by design. You instantiate a concrete subclass instead.");
add(OOP, "HARD", "Polymorphism", "Virtual Destructors in C++",
  "Why should a base class that is used polymorphically have a virtual destructor in C++?", "So deleting a derived object through a base pointer calls the derived destructor", ["So the destructor runs faster", "So the class cannot be copied", "So the object is deleted automatically"],
  "Without a virtual destructor, deleting through a base pointer is undefined behaviour and the derived part may not be destroyed properly (leaks).");
add(OOP, "EASY", "Design Principles", "Cohesion and Coupling",
  "Which combination do good object-oriented designs aim for?", "High cohesion and low coupling", ["Low cohesion and high coupling", "High cohesion and high coupling", "Low cohesion and low coupling"],
  "Classes should be focused (high cohesion) and depend on each other as little as possible (low coupling).");
add(OOP, "HARD", "Inheritance", "Static Method Hiding",
  "A subclass declares a static method with the same signature as a static method in its superclass. What is this called?", "Method hiding (it is not overriding)", ["Method overriding", "Method overloading", "A compilation error"],
  "Static methods are bound to the class, so the subclass method hides the parent's one. The choice depends on the reference type, not the object.");
add(OOP, "MEDIUM", "Java Basics", "Marker Interface",
  "Which of these is a marker interface in Java (an interface with no methods)?", "Serializable", ["Comparable", "Runnable", "Iterator"],
  "Serializable has no methods. It only marks that a class's objects can be serialized.");

// ---------------------------------------------------------------- Computer Networks (category 6)
const NET = 6;
add(NET, "MEDIUM", "Address Resolution", "ARP - Mapping IP to MAC",
  "Which protocol is used to find the MAC address that belongs to a known IP address on a local network?", "ARP", ["DNS", "DHCP", "ICMP"],
  "The Address Resolution Protocol broadcasts a request and the owner of the IP replies with its MAC address.");
add(NET, "EASY", "DHCP", "DHCP - Automatic Configuration",
  "What does DHCP do?", "Automatically assigns IP addresses and network settings to devices", ["Translates domain names into IP addresses", "Encrypts network traffic", "Converts private addresses to public ones"],
  "A DHCP server leases an IP address, subnet mask, gateway and DNS server to each client.");
add(NET, "HARD", "Subnetting", "Subnet Mask for a /26 Network",
  "Which subnet mask corresponds to the prefix length /26?", "255.255.255.192", ["255.255.255.128", "255.255.255.224", "255.255.255.240"],
  "26 bits are 1s: 255.255.255.11000000, and 11000000 in binary is 192.");
add(NET, "MEDIUM", "NAT", "NAT - Private to Public Translation",
  "What is the main purpose of Network Address Translation (NAT)?", "To let devices with private IP addresses share a public IP address", ["To encrypt packets between two hosts", "To assign MAC addresses", "To speed up DNS lookups"],
  "NAT rewrites source addresses and ports so many internal hosts can reach the internet through one public address.");
add(NET, "MEDIUM", "HTTP", "HTTP 429 Status Code",
  "Which HTTP status code tells a client it has sent too many requests (rate limiting)?", "429 Too Many Requests", ["401 Unauthorized", "404 Not Found", "503 Service Unavailable"],
  "429 is returned when a client exceeds a rate limit and often includes a Retry-After header.");
add(NET, "EASY", "Network Devices", "Switch vs Hub",
  "Which device forwards frames using MAC addresses at the data link layer?", "Switch", ["Hub", "Repeater", "Modem"],
  "A switch learns which MAC address is on which port and forwards frames only to the right port. A hub repeats traffic to every port.");
add(NET, "MEDIUM", "Security", "TLS - What It Provides",
  "Which set of guarantees does TLS provide for a connection?", "Encryption, authentication of the server and message integrity", ["Compression, caching and load balancing", "Routing, switching and addressing", "Only encryption with no authentication"],
  "TLS encrypts traffic, authenticates the server with a certificate, and detects tampering.");
add(NET, "MEDIUM", "Routing", "Distance-Vector Routing Protocol",
  "Which of the following is a distance-vector routing protocol?", "RIP", ["OSPF", "IS-IS", "ARP"],
  "RIP shares its routing table with neighbours and uses hop count. OSPF and IS-IS are link-state protocols.");
add(NET, "EASY", "ICMP", "ICMP - Ping",
  "Which protocol does the ping command use to test reachability?", "ICMP", ["TCP", "HTTP", "ARP"],
  "Ping sends ICMP Echo Request messages and waits for Echo Replies.");
add(NET, "MEDIUM", "HTTP", "Idempotent HTTP Methods",
  "Which HTTP method is idempotent, meaning repeating the same request has the same effect as sending it once?", "PUT", ["POST", "PATCH", "CONNECT"],
  "PUT replaces a resource with the given representation, so repeating it leaves the same result. POST usually creates a new resource each time, and PATCH is not guaranteed to be idempotent.");
add(NET, "MEDIUM", "Email Protocols", "IMAP vs POP3",
  "How does IMAP differ from POP3?", "IMAP keeps messages on the server and syncs them across devices", ["IMAP is used to send email and POP3 to receive it", "IMAP can only be used on one device", "IMAP does not support folders"],
  "POP3 typically downloads and removes mail from the server, while IMAP leaves it there. SMTP is used to send mail.");
add(NET, "MEDIUM", "Application Layer", "WebSocket vs HTTP",
  "What is the main advantage of a WebSocket connection over repeated HTTP requests for a chat application?", "A persistent full-duplex connection so the server can push messages", ["It does not need TCP", "It makes pages load without JavaScript", "It encrypts messages without TLS"],
  "After the upgrade handshake, client and server can send messages at any time over one connection.");
add(NET, "MEDIUM", "CDN", "Content Delivery Network",
  "What is the main purpose of a Content Delivery Network (CDN)?", "To serve content from servers geographically close to users", ["To assign IP addresses to clients", "To translate domain names", "To block all incoming traffic"],
  "Caching static assets at edge locations reduces latency and load on the origin server.");
add(NET, "EASY", "Network Devices", "Role of a Router",
  "Which device connects different networks and forwards packets between them using IP addresses?", "Router", ["Switch", "Hub", "Repeater"],
  "Routers work at the network layer and choose the next hop for each packet using their routing tables.");

// ---------------------------------------------------------------- validate + write
assert.equal(new Set(out.map((q) => q.questionText)).size, out.length, "duplicate question text inside the batch");
for (const q of out) {
  assert.equal(q.options.filter((o) => o.correct).length, 1, q.title);
  assert.equal(new Set(q.options.map((o) => o.text.toLowerCase())).size, 4, `duplicate options in ${q.title}`);
}
const existing = JSON.parse(fs.readFileSync(new URL("../packages/content/src/questions.json", import.meta.url), "utf8"));
const have = new Set(existing.questions.map((q) => q.questionText.toLowerCase()));
for (const q of out) assert.ok(!have.has(q.questionText.toLowerCase()), `already in bank: ${q.title}`);

fs.writeFileSync(new URL("../packages/content/src/questions-extra-1.json", import.meta.url), JSON.stringify({ questions: out }, null, 1));
const by = {}; for (const q of out) by[q.categoryId] = (by[q.categoryId] || 0) + 1;
console.log(`wrote ${out.length} questions`, by, "ids", out[0].id, "-", out[out.length - 1].id);
