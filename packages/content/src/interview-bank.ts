// Mock-interview question bank. Hand-written for campus placements; no third-party dataset is copied.
//
// Technical questions are scored by concept coverage: each concept lists words an answer that
// understands it would normally use. A term matches a word that STARTS with it ("encapsulat" matches
// "encapsulation"), and a term with a space matches that phrase. Authors choose the stems.
// This is a rule-based check, not understanding: it cannot tell a wrong sentence that uses the right
// words from a correct one. The report says so.
//
// Line format for concepts:  "Label = term | term | term"   (a trailing "*2" on the label doubles its weight)

export type InterviewDifficulty = "EASY" | "MEDIUM" | "HARD";
export type InterviewKind = "TECHNICAL" | "HR";

export type Concept = { label: string; terms: string[]; weight: number };

export type InterviewQuestion = {
  id: string;
  kind: InterviewKind;
  /** Technical: the subject. HR: the competency being tested. */
  topic: string;
  difficulty: InterviewDifficulty;
  text: string;
  /** Taxonomy skill names this question exercises (technical only). */
  skills: string[];
  concepts: Concept[];
  modelAnswer: string;
  /** Short advice shown in the report. */
  tip: string;
};

function parseConcept(raw: string): Concept {
  const at = raw.indexOf(" = ");
  const left = raw.slice(0, at);
  const right = raw.slice(at + 3);
  const m = left.trim().match(/^(.*?)(?:\s*\*(\d))?$/);
  const label = (m?.[1] ?? left).trim();
  const weight = m?.[2] ? Number(m[2]) : 1;
  return { label, weight, terms: right.split("|").map((t) => t.trim().toLowerCase()).filter(Boolean) };
}

const T = (
  id: string, topic: string, difficulty: InterviewDifficulty, skills: string[], text: string,
  concepts: string[], modelAnswer: string, tip = "",
): InterviewQuestion => ({
  id, kind: "TECHNICAL", topic, difficulty, text, skills, concepts: concepts.map(parseConcept), modelAnswer,
  tip: tip || `Revise ${topic} and practise explaining it in your own words with one example.`,
});

const H = (id: string, topic: string, difficulty: InterviewDifficulty, text: string, concepts: string[], modelAnswer: string, tip: string): InterviewQuestion => ({
  id, kind: "HR", topic, difficulty, text, skills: [], concepts: concepts.map(parseConcept), modelAnswer, tip,
});

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ---------- Object-oriented programming ----------
  T("oop-pillars", "OOP", "EASY", ["Object-Oriented Programming"], "What are the four pillars of object-oriented programming? Explain each briefly.",
    ["Encapsulation = encapsulat|data hiding|private|getter", "Abstraction = abstract|hide complexity|interface", "Inheritance = inherit|extend|parent class|child class|subclass", "Polymorphism = polymorph|overrid|overload|many forms"],
    "Encapsulation bundles data and methods and hides internals behind access modifiers. Abstraction exposes only what is needed, for example through interfaces. Inheritance lets a child class reuse and extend a parent class. Polymorphism lets one interface behave differently, through overriding at run time and overloading at compile time."),
  T("oop-abstract-vs-interface", "OOP", "MEDIUM", ["Object-Oriented Programming", "Java"], "What is the difference between an abstract class and an interface?",
    ["Abstract class can hold state = state|field|instance variable|constructor|non-abstract|concrete method", "Interface is a contract = contract|only declare|method signature|implements|capabilit", "Single vs multiple = multiple|single inheritance|one class|many interface|only one|implement many", "When to use which = is-a|can-do|common base|unrelated classes|default method"],
    "An abstract class can have fields, constructors and concrete methods, and a class can extend only one. An interface is a contract of method signatures (with optional default methods) and a class can implement many. Use an abstract class for a shared base with state, an interface for a capability that unrelated classes can have."),
  T("oop-overload-override", "OOP", "EASY", ["Object-Oriented Programming", "Java"], "Explain method overloading and method overriding with the difference between them.",
    ["Overloading = overload|same name|different parameter|compile time|static binding", "Overriding = overrid|subclass|redefin|same signature|run time|runtime|dynamic", "Difference = differ|whereas|while|compile|run time"],
    "Overloading means several methods with the same name but different parameters in one class, resolved at compile time. Overriding means a subclass redefines a parent method with the same signature, resolved at run time by the actual object type."),
  T("oop-solid", "OOP", "HARD", ["Object-Oriented Programming", "System Design"], "What are the SOLID principles? Pick two and give an example.",
    ["Single responsibility = single responsibility|one reason to change", "Open/closed = open closed|open for extension|closed for modification", "Liskov = liskov|substitut", "Interface segregation = interface segregation|small interface|not forced", "Dependency inversion = dependency inversion|depend on abstraction|inject", "Gives an example = for example|for instance|e.g|suppose|say a"],
    "SOLID: single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion. For example, a class that both calculates salary and prints reports breaks single responsibility; splitting them means each changes for one reason."),
  T("oop-constructor-types", "OOP", "EASY", ["Object-Oriented Programming"], "What is a constructor? Can a constructor be inherited or overloaded?",
    ["Initialises an object = initiali|creates an object|object creation|called when|new keyword", "Same name as class, no return type = same name|no return type|class name", "Can be overloaded = overload|multiple constructor|different parameter", "Not inherited = not inherit|cannot be inherit|super|chain"],
    "A constructor runs when an object is created and initialises it. It has the class name and no return type. It can be overloaded, but it is not inherited; a subclass calls the parent constructor with super()."),
  T("oop-composition", "OOP", "MEDIUM", ["Object-Oriented Programming", "System Design"], "Composition or inheritance: which would you prefer and why?",
    ["Composition = composition|has-a|contain|delegat", "Inheritance = inherit|is-a|extend", "Coupling and flexibility = coupl|flexib|tight|loose|change at run time|fragile", "Prefer composition = prefer composition|favour composition|favor composition|rather than inherit|instead of inherit"],
    "Prefer composition: it models has-a, keeps classes loosely coupled and can be swapped at run time, while deep inheritance makes classes tightly coupled and fragile. Use inheritance only for a true is-a relationship."),

  // ---------- Data structures and algorithms ----------
  T("ds-array-vs-linkedlist", "Data Structures", "EASY", ["Data Structures"], "Compare an array and a linked list. When would you choose each?",
    ["Array: index access O(1) = random access|index|constant time|o(1)|contiguous", "Linked list: easy insert/delete = insert|delet|pointer|node|dynamic size", "Costs = o(n)|shift|traverse|linear|memory overhead", "Choice = when|if you need|prefer|choose"],
    "An array has contiguous memory and O(1) index access, but inserting or deleting in the middle shifts elements, O(n). A linked list stores nodes with pointers, so insert or delete at a known node is O(1) but access is O(n) and each node costs extra memory. Choose arrays for frequent reads, lists for frequent inserts and deletes."),
  T("ds-stack-queue", "Data Structures", "EASY", ["Data Structures"], "What is the difference between a stack and a queue? Give a real use of each.",
    ["Stack is LIFO = lifo|last in first out|last-in", "Queue is FIFO = fifo|first in first out|first-in", "Stack use = undo|recursion|call stack|parenthes|backtrack|browser back", "Queue use = scheduling|bfs|breadth first|printer|buffer|request queue"],
    "A stack is last-in first-out: used for undo, recursion and bracket matching. A queue is first-in first-out: used for scheduling, BFS and buffers."),
  T("ds-hashmap", "Data Structures", "MEDIUM", ["Data Structures", "Java"], "How does a hash map work internally? What happens on a collision?",
    ["Hash function maps key to index = hash function|hashcode|hash code|index|bucket", "Average O(1) = o(1)|constant|average", "Collision handling = collision|chaining|linked list|open addressing|probing|treeif", "Resizing = resiz|load factor|rehash|capacity", "Equal keys use equals = equals|same key|overwrite|replace"],
    "A hash function turns a key into a bucket index so get and put are O(1) on average. Different keys can land in the same bucket (collision), handled by chaining (list or tree per bucket) or open addressing. When the load factor is exceeded the table resizes and rehashes. Equal keys are found with equals()."),
  T("ds-binary-search", "Algorithms", "EASY", ["Algorithms"], "Explain binary search. What is its time complexity and what does it require?",
    ["Sorted input = sorted|order", "Halve the range = middle|mid|half|divide|low|high|left|right", "O(log n) = log n|logarithm|o(log", "Iterative or recursive = loop|iterat|recurs|until"],
    "Binary search needs sorted data. Compare with the middle element and discard the half that cannot contain the target, repeating until found or empty. It is O(log n) time and O(1) space when written iteratively."),
  T("ds-sorting-compare", "Algorithms", "MEDIUM", ["Algorithms", "Data Structures"], "Compare quick sort and merge sort. Which would you use and when?",
    ["Quick sort = quick|pivot|partition|in-place|in place", "Merge sort = merge|divide and conquer|stable|extra space|o(n) space", "Time complexity = n log n|o(n log|nlogn|worst case|o(n2)|n squared|quadratic", "Trade-off = stable|memory|cache|linked list|external|worst"],
    "Both are O(n log n) on average. Quick sort partitions around a pivot, works in place and is usually faster in practice but is O(n^2) in the worst case and not stable. Merge sort is always O(n log n) and stable but needs O(n) extra space, so it suits linked lists and external sorting."),
  T("ds-bst", "Data Structures", "MEDIUM", ["Data Structures"], "What is a binary search tree? What goes wrong with it and how is that fixed?",
    ["Ordering property = left|right|smaller|greater|less than|ordered", "O(log n) operations = log n|o(log|search|insert|height", "Skewed worst case = skew|degenerate|linear|o(n)|sorted order|linked list", "Balanced trees = balanc|avl|red-black|red black|rotation|self-balancing"],
    "In a BST the left subtree holds smaller keys and the right larger ones, so search, insert and delete take O(height), O(log n) when balanced. Inserting sorted data makes it skewed like a list, O(n). Self-balancing trees such as AVL and red-black trees rotate to keep the height logarithmic."),
  T("ds-bfs-dfs", "Algorithms", "MEDIUM", ["Algorithms", "Data Structures"], "Explain BFS and DFS on a graph. What data structure does each use and where is each useful?",
    ["BFS uses a queue = queue|level by level|level order|layer", "DFS uses a stack or recursion = stack|recurs|deep|backtrack", "Visited set = visited|cycle|seen|mark", "Uses = shortest path|unweighted|connected component|topological|cycle detection|maze", "Complexity = o(v|v + e|vertices|edges"],
    "BFS explores level by level with a queue and finds shortest paths in unweighted graphs. DFS goes deep first using a stack or recursion and suits cycle detection, topological sort and connected components. Both keep a visited set and run in O(V + E)."),
  T("ds-dp", "Algorithms", "HARD", ["Algorithms", "Problem Solving"], "What is dynamic programming? How do you recognise a problem that needs it?",
    ["Overlapping subproblems = overlapping|repeated|same subproblem|recomput", "Optimal substructure = optimal substructure|built from|optimal solution of", "Memoisation or tabulation = memo|tabulat|cache|bottom-up|bottom up|top-down|top down|table", "Example = fibonacci|knapsack|longest common|coin change|for example|e.g"],
    "Dynamic programming solves problems with overlapping subproblems and optimal substructure by storing sub-results, either top-down with memoisation or bottom-up with a table. Fibonacci, knapsack and coin change are classic examples; a plain recursion that repeats the same calls is the sign."),
  T("ds-complexity", "Algorithms", "EASY", ["Algorithms"], "What is time complexity and Big-O notation? Give examples of O(1), O(n) and O(n^2).",
    ["Growth with input size = input size|grows|scale|as n", "Upper bound = upper bound|worst case|asymptot|ignore constant", "O(1) example = o(1)|constant|array index|hash lookup", "O(n) example = o(n)|linear|single loop|traverse", "O(n^2) example = o(n2)|o(n^2)|quadratic|nested loop|two loops"],
    "Big-O describes how running time grows with input size, as an upper bound ignoring constants. Indexing an array is O(1), a single loop is O(n), and nested loops over the same input are O(n^2)."),
  T("ds-heap", "Data Structures", "MEDIUM", ["Data Structures"], "What is a heap and where is it used?",
    ["Complete binary tree with heap property = complete binary tree|parent|min-heap|max-heap|min heap|max heap|root", "Operations = insert|extract|o(log n)|heapify|peek|o(1)", "Priority queue = priority queue", "Uses = top k|scheduling|dijkstra|heap sort|median|kth"],
    "A heap is a complete binary tree where each parent is smaller (min-heap) or larger (max-heap) than its children. Insert and extract are O(log n), peek is O(1). It backs priority queues, heap sort, top-k problems and Dijkstra."),
  T("ds-recursion", "Algorithms", "EASY", ["Algorithms", "Problem Solving"], "What is recursion? What are its risks and how do you avoid them?",
    ["Function calls itself = calls itself|itself|self", "Base case = base case|terminat|stop condition", "Stack overflow = stack overflow|call stack|deep|memory", "Alternatives = iterat|loop|memo|tail"],
    "Recursion is a function solving a problem by calling itself on a smaller input. It needs a base case to stop, and deep recursion can overflow the call stack. Use iteration, memoisation or tail-call style when depth is large."),

  // ---------- DBMS and SQL ----------
  T("db-acid", "DBMS", "MEDIUM", ["DBMS", "SQL"], "What are the ACID properties of a transaction?",
    ["Atomicity = atomic|all or nothing|rollback", "Consistency = consisten|valid state|constraint", "Isolation = isolat|concurrent|do not interfere|independent", "Durability = durab|committed|persist|crash|survive"],
    "Atomicity: all or nothing. Consistency: a transaction moves the database from one valid state to another. Isolation: concurrent transactions do not see each other's partial work. Durability: committed data survives crashes."),
  T("db-normalisation", "DBMS", "MEDIUM", ["DBMS", "Database Design"], "What is normalisation? Explain 1NF, 2NF and 3NF.",
    ["Purpose = redundan|anomal|duplicate|consistency", "1NF = 1nf|first normal|atomic|single value|repeating group", "2NF = 2nf|second normal|partial dependency|composite key", "3NF = 3nf|third normal|transitive|non-key|bcnf"],
    "Normalisation organises tables to reduce redundancy and anomalies. 1NF: atomic values, no repeating groups. 2NF: 1NF plus no partial dependency on part of a composite key. 3NF: 2NF plus no transitive dependency between non-key columns."),
  T("db-joins", "SQL", "EASY", ["SQL"], "Explain the types of SQL joins with a short example.",
    ["Inner join = inner|matching rows|both tables|common", "Left join = left|all rows from the left|null", "Right join = right", "Full outer join = full|outer|all rows from both", "Example = for example|e.g|such as|employee|department|orders|customer"],
    "INNER JOIN returns rows that match in both tables. LEFT JOIN returns every row from the left table with NULLs where there is no match; RIGHT JOIN is the mirror. FULL OUTER JOIN returns all rows from both. For example, employees LEFT JOIN departments keeps employees without a department."),
  T("db-index", "DBMS", "MEDIUM", ["DBMS", "SQL"], "What is a database index? What are its benefits and costs?",
    ["Speeds up lookups = faster|speed|lookup|search|avoid full scan|full table scan", "Data structure = b-tree|b tree|btree|hash|tree", "Costs = slower write|insert|update|extra space|storage|overhead|maintain", "When to use = where clause|join|frequently|selective|column|primary key"],
    "An index (usually a B-tree) lets the database find rows without scanning the whole table, which speeds up WHERE, JOIN and ORDER BY. The cost is extra storage and slower inserts and updates, so index columns that are queried often and are selective."),
  T("db-pk-fk", "DBMS", "EASY", ["DBMS", "Database Design"], "What is the difference between a primary key, a foreign key and a unique key?",
    ["Primary key = primary|uniquely identif|not null|one per table", "Foreign key = foreign|reference|another table|relationship|referential", "Unique key = unique|duplicate|null", "Differences = one primary|many unique|can be null|only one|per table|several|may allow"],
    "A primary key uniquely identifies each row, cannot be null and there is one per table. A foreign key refers to a key in another table to link rows and enforce referential integrity. A unique key forbids duplicates but a table can have several and they may allow a null."),
  T("db-sql-vs-nosql", "DBMS", "MEDIUM", ["DBMS", "MongoDB"], "SQL versus NoSQL databases: how do they differ and how would you choose?",
    ["SQL: structured schema and joins = schema|table|relational|join|structured|acid", "NoSQL: flexible data = flexible|document|key-value|key value|graph|json|schemaless|unstructured", "Scaling = scal|horizontal|vertical|shard|distribut", "Choice = depends|use case|consisten|transaction|requirement|when"],
    "SQL databases use fixed schemas, joins and strong ACID guarantees, which suits structured and transactional data. NoSQL stores (document, key-value, graph) have flexible schemas and scale horizontally more easily, which suits large or changing data. Choose by the consistency and query needs of the application."),
  T("db-delete-truncate-drop", "SQL", "EASY", ["SQL"], "What is the difference between DELETE, TRUNCATE and DROP?",
    ["DELETE removes selected rows = delete|where|row by row|rollback|dml", "TRUNCATE empties the table = truncate|all rows|reset|faster|ddl", "DROP removes the table = drop|structure|schema|table itself|permanent", "Rollback or filters = rollback|where clause|cannot|can be"],
    "DELETE removes chosen rows with WHERE and can be rolled back. TRUNCATE removes all rows quickly and keeps the table structure. DROP removes the table itself, structure and data."),
  T("db-group-having", "SQL", "EASY", ["SQL"], "What is the difference between WHERE and HAVING?",
    ["WHERE filters rows = where|row|before group", "HAVING filters groups = having|group|aggregate|after group", "Aggregates = count|sum|avg|aggregate|group by"],
    "WHERE filters individual rows before grouping and cannot use aggregates. HAVING filters groups after GROUP BY and can use aggregates such as COUNT or SUM."),
  T("db-isolation-levels", "DBMS", "HARD", ["DBMS"], "What are transaction isolation levels and the problems they prevent?",
    ["Dirty read = dirty read|uncommitted", "Non-repeatable read = non-repeatable|nonrepeatable|same row twice", "Phantom read = phantom|new rows", "Levels = read uncommitted|read committed|repeatable read|serializable", "Trade-off = performance|concurrency|stricter|slower|lock"],
    "Isolation levels trade correctness for concurrency: read uncommitted allows dirty reads, read committed prevents them, repeatable read also prevents non-repeatable reads, and serializable also prevents phantom reads but is the slowest."),

  // ---------- Operating systems ----------
  T("os-process-thread", "Operating Systems", "EASY", ["Operating Systems"], "What is the difference between a process and a thread?",
    ["Process is an independent program = process|own memory|address space|isolated|independent", "Thread is a unit inside a process = thread|within a process|lightweight|share", "Sharing = share|heap|same memory|code and data", "Cost = context switch|creation|overhead|cheaper|faster|communicat"],
    "A process is a running program with its own address space. A thread is a lightweight unit of execution inside a process; threads share the heap and code but have their own stack and registers. Threads are cheaper to create and switch, but sharing memory needs synchronisation."),
  T("os-deadlock", "Operating Systems", "MEDIUM", ["Operating Systems"], "What is a deadlock? What conditions cause it and how can it be prevented?",
    ["Definition = waiting for each other|wait for each other|stuck|blocked|circular", "Mutual exclusion = mutual exclusion", "Hold and wait = hold and wait", "No preemption = no preemption|cannot be taken|non-preempt", "Circular wait = circular wait", "Prevention = prevent|avoid|break|lock ordering|order|banker|timeout"],
    "A deadlock is when processes wait on each other forever. It needs mutual exclusion, hold and wait, no preemption and circular wait together. Break any one, for example by acquiring locks in a fixed order, or avoid it with the banker's algorithm."),
  T("os-scheduling", "Operating Systems", "MEDIUM", ["Operating Systems"], "Explain CPU scheduling and compare two scheduling algorithms.",
    ["Purpose = which process|which ready|runs next|cpu time|ready queue|utilisation|utilization|throughput", "FCFS = fcfs|first come|first-come|convoy", "Shortest job first = sjf|shortest job|shortest remaining|starvation", "Round robin = round robin|time quantum|time slice|fair", "Preemptive = preempt|non-preempt"],
    "The scheduler chooses which ready process runs next. FCFS is simple but short jobs wait behind long ones (convoy effect). SJF minimises average waiting time but can starve long jobs. Round robin gives each process a time quantum, which is fair and responsive. Algorithms can be preemptive or non-preemptive."),
  T("os-paging", "Operating Systems", "MEDIUM", ["Operating Systems"], "What is virtual memory and paging? What is a page fault?",
    ["Virtual memory = virtual|larger than ram|illusion|disk|swap", "Paging = page|frame|fixed size|page table", "Page fault = page fault|not in memory|not present|load from disk|trap", "Replacement = replacement|lru|fifo|thrashing|evict"],
    "Virtual memory lets a process use more memory than is physically available by keeping pages on disk. Memory is split into fixed-size pages mapped to frames by a page table. A page fault happens when a page is not in RAM; the OS loads it and may evict another using a policy like LRU. Too many faults cause thrashing."),
  T("os-semaphore-mutex", "Operating Systems", "MEDIUM", ["Operating Systems"], "What is the difference between a mutex and a semaphore?",
    ["Mutex = mutex|lock|owner|one thread|mutual exclusion", "Semaphore = semaphore|counter|count|signal|wait", "Binary vs counting = binary|counting|n threads|multiple", "Use = critical section|race condition|synchron|producer|resource"],
    "A mutex is a lock owned by one thread that gives exclusive access to a critical section. A semaphore is a counter used to signal or to allow up to N threads at once. Both prevent race conditions."),
  T("os-race-condition", "Operating Systems", "EASY", ["Operating Systems"], "What is a race condition and how do you prevent it?",
    ["Definition = race|shared|concurrent|order of execution|timing|unpredictable", "Critical section = critical section|shared data|shared variable", "Fix = lock|mutex|synchroniz|atomic|semaphore|thread-safe|thread safe", "Example = for example|e.g|counter|increment|bank|balance"],
    "A race condition occurs when the result depends on the timing of threads accessing shared data. Protect the critical section with locks, synchronised blocks or atomic operations. For example two threads incrementing one counter can lose an update."),
  T("os-context-switch", "Operating Systems", "EASY", ["Operating Systems"], "What is a context switch and why is it costly?",
    ["Save and restore state = save|restore|state|register|pcb|process control block", "Switch between processes = switch|another process|next process|cpu", "Cost = overhead|cost|cache|tlb|time|no useful work"],
    "A context switch saves the state of the running process (registers, program counter) in its PCB and loads another's. It is overhead because no useful work happens during it and CPU caches and the TLB lose their warmed-up contents."),

  // ---------- Computer networks ----------
  T("cn-osi-tcpip", "Computer Networks", "EASY", ["Computer Networks"], "Explain the OSI model. Name its layers and what one or two of them do.",
    ["Seven layers = seven|7 layer|layers", "Lower layers = physical|data link|network layer", "Upper layers = transport|session|presentation|application", "Purpose of a layer = routing|ip address|segment|packet|frame|tcp|encrypt|http|mac address"],
    "The OSI model has seven layers: physical, data link, network, transport, session, presentation, application. The network layer routes packets using IP addresses; the transport layer provides end-to-end delivery with TCP or UDP."),
  T("cn-tcp-udp", "Computer Networks", "EASY", ["Computer Networks"], "What is the difference between TCP and UDP?",
    ["TCP is reliable = reliab|acknowledg|retransmi|ordered|in order|guarantee", "TCP connection = connection|handshake|connection-oriented", "UDP is fast and connectionless = connectionless|no handshake|fast|low latency|lightweight|best effort|no guarantee", "Uses = http|file|email|video|streaming|gaming|dns|voip"],
    "TCP is connection-oriented and reliable: it uses a handshake, acknowledgements, retransmission and ordering, so it suits web pages and file transfer. UDP is connectionless and has no guarantees but is faster and lighter, so it suits streaming, gaming and DNS."),
  T("cn-http-https", "Computer Networks", "EASY", ["Computer Networks", "REST APIs"], "What happens when you type a URL into the browser and press Enter?",
    ["DNS lookup = dns|domain|ip address", "TCP connection = tcp|handshake|connect", "TLS for https = tls|ssl|https|certificate|encrypt", "HTTP request and response = http request|get request|response|status code|server", "Browser renders = render|html|css|dom|display|parse"],
    "The browser resolves the domain to an IP with DNS, opens a TCP connection (and a TLS handshake for HTTPS), sends an HTTP request, receives the response and renders the HTML, CSS and JavaScript."),
  T("cn-http-methods", "Computer Networks", "EASY", ["REST APIs"], "Explain the common HTTP methods and status code ranges.",
    ["GET = get|read|retrieve|fetch", "POST = post|create|submit", "PUT/PATCH = put|patch|update|replace", "DELETE = delete|remove", "Status codes = 200|2xx|404|4xx|500|5xx|status code|redirect|3xx"],
    "GET reads, POST creates, PUT replaces, PATCH partially updates and DELETE removes. Status codes: 2xx success, 3xx redirect, 4xx client error such as 404, 5xx server error such as 500."),
  T("cn-dns", "Computer Networks", "MEDIUM", ["Computer Networks"], "How does DNS work?",
    ["Maps names to IP addresses = domain|name|ip address|translate|phonebook|phone book", "Resolver and caching = resolver|cache|ttl|recursive", "Hierarchy = root|tld|authoritative|name server|nameserver|hierarch", "Record types = a record|cname|mx|record|a, cname"],
    "DNS translates domain names to IP addresses. A resolver checks its cache, then queries root servers, TLD servers and finally the authoritative name server, caching the answer for its TTL. Records come in types such as A, CNAME and MX."),
  T("cn-ip-subnet", "Computer Networks", "MEDIUM", ["Computer Networks"], "What is an IP address and what is subnetting?",
    ["IP identifies a host = identif|address of|host|device|ipv4|ipv6|32|128", "Network and host part = network|host part|prefix|netmask|subnet mask|cidr", "Subnetting splits a network = divid|split|smaller network|subnet", "Why = efficien|waste|security|broadcast|manage|isolat"],
    "An IP address identifies a device on a network (32 bits in IPv4, 128 in IPv6) and has a network part and a host part defined by the subnet mask or CIDR prefix. Subnetting divides a network into smaller ones to use addresses efficiently and limit broadcast traffic."),

  // ---------- Web, JavaScript, APIs ----------
  T("web-rest", "Web Development", "EASY", ["REST APIs"], "What is a REST API? What makes an API RESTful?",
    ["Resources and URLs = resource|url|endpoint|noun", "HTTP methods = get|post|put|delete|http method", "Stateless = stateless|no session|each request", "JSON representation = json|representation|xml", "Status codes = status code|200|404"],
    "REST is an architectural style where resources are identified by URLs and manipulated with HTTP methods. Calls are stateless, so each request carries what the server needs, and data is usually JSON with meaningful status codes."),
  T("js-var-let-const", "JavaScript", "EASY", ["JavaScript"], "What is the difference between var, let and const in JavaScript?",
    ["var is function scoped = function scope|function-scoped|hoist", "let and const are block scoped = block scope|block-scoped|curly", "const cannot be reassigned = reassign|constant|cannot change|immutable binding", "Temporal dead zone = temporal dead zone|tdz|before declaration"],
    "var is function-scoped and hoisted; let and const are block-scoped and sit in the temporal dead zone before their declaration. const cannot be reassigned, though an object it holds can still be mutated."),
  T("js-closure", "JavaScript", "MEDIUM", ["JavaScript"], "What is a closure in JavaScript? Give an example.",
    ["Function remembers its scope = remember|outer|enclosing|lexical|scope", "Access after outer returns = after|even when|returns|still access", "Use = private|counter|callback|encapsulat|factory|data hiding", "Example = for example|e.g|function|counter"],
    "A closure is a function that keeps access to the variables of the scope where it was created, even after that outer function has returned. It is used for private state, counters and callbacks."),
  T("js-async", "JavaScript", "MEDIUM", ["JavaScript"], "Explain callbacks, promises and async/await. Why do we need them?",
    ["Asynchronous work = asynchronous|non-blocking|non blocking|does not block|network|timer", "Callback = callback|callback hell", "Promise = promise|then|resolve|reject|catch", "Async/await = async|await|syntactic|readable|try", "Event loop = event loop|single thread|queue"],
    "JavaScript is single-threaded, so slow work such as network calls is asynchronous. Callbacks run when it finishes but nest badly; promises represent a future value and chain with then/catch; async/await lets you write promise code in a readable sequential style. The event loop schedules the callbacks."),
  T("js-equality", "JavaScript", "EASY", ["JavaScript"], "What is the difference between == and === in JavaScript?",
    ["== converts types = type coercion|coerc|convert|loose", "=== checks type and value = strict|same type|both type and value|without conversion", "Recommendation = prefer|always use|avoid ==|best practice"],
    "== compares after type coercion (so 0 == '0' is true) while === compares type and value without conversion. Prefer ===."),
  T("web-cookies-sessions", "Web Development", "MEDIUM", ["Authentication"], "Explain cookies, sessions and JWT for authentication.",
    ["Cookie = cookie|browser stores|sent with every request|httponly|http-only", "Session = session|server stores|session id|server-side", "JWT = jwt|token|signed|stateless|payload|signature", "Security = secure|httponly|expire|csrf|xss|hash|https|samesite"],
    "A cookie is data the browser stores and sends with requests. A session keeps state on the server and the cookie holds only an id. A JWT is a signed token carrying claims so the server can stay stateless. Protect them with HTTPS, httpOnly and SameSite cookies, short expiry and hashed passwords."),
  T("web-cors", "Web Development", "MEDIUM", ["REST APIs"], "What is CORS and why does the browser enforce it?",
    ["Same-origin policy = same-origin|same origin|origin", "Cross-origin requests blocked = block|cross origin|different domain|different origin|restrict|own origin|unless the server", "Server sends headers = header|access-control|allow-origin|preflight|options", "Security reason = security|malicious|steal|protect|csrf"],
    "Browsers apply the same-origin policy: a page can only call APIs on its own origin unless the server allows others with CORS headers such as Access-Control-Allow-Origin. It stops malicious sites from reading data from another site using the user's session."),
  T("web-react-state", "React", "MEDIUM", ["React"], "What are props and state in React? How do hooks like useState and useEffect work?",
    ["Props = prop|passed from parent|read-only|read only|immutable", "State = state|usestate|changes|re-render|rerender", "useEffect = useeffect|side effect|lifecycle|dependency array|after render|fetch", "Re-render on change = render|update|virtual dom"],
    "Props are read-only inputs passed from a parent. State is data owned by the component; changing it with useState re-renders the component. useEffect runs side effects such as fetching data after render, and its dependency array controls when it reruns."),
  T("web-virtual-dom", "React", "MEDIUM", ["React"], "What is the virtual DOM and why does React use it?",
    ["In-memory copy of the DOM = virtual dom|in-memory|in memory|copy|lightweight", "Diffing = diff|compare|reconcil", "Minimal real DOM updates = minimal|only the changed|update only|batch|efficient|real dom", "Why = performance|slow|expensive|fast"],
    "The virtual DOM is a lightweight in-memory tree of the UI. On a state change React builds a new tree, diffs it with the old one and updates only the parts of the real DOM that changed, because real DOM updates are expensive."),
  T("web-html-semantic", "Web Development", "EASY", ["HTML", "CSS"], "What is the CSS box model and what is the difference between display block, inline and inline-block?",
    ["Box model layers = content|padding|border|margin", "Block = block|full width|new line", "Inline = inline|same line|cannot set width|width and height", "Inline-block = inline-block|inline block|both"],
    "The box model wraps content in padding, then border, then margin. Block elements take the full width and start a new line, inline elements flow in a line and ignore width and height, and inline-block flows in a line but accepts width and height."),
  T("web-api-design", "System Design", "MEDIUM", ["REST APIs", "System Design"], "How would you design a REST API for a to-do application?",
    ["Resources and routes = /todos|/tasks|resource|endpoint|route|url", "HTTP methods mapping = get|post|put|patch|delete", "Status codes and validation = status|validat|201|404|400", "Auth and ownership = auth|user|token|login|owner", "Pagination or filtering = paginat|filter|page|query"],
    "Expose a /todos resource: GET list (with pagination and filters), POST create (201), GET /todos/{id}, PUT or PATCH update, DELETE remove. Validate input, return proper status codes, and authenticate users so each sees only their own todos."),

  // ---------- Java ----------
  T("java-jvm", "Java", "EASY", ["Java"], "What are JDK, JRE and JVM in Java?",
    ["JVM runs bytecode = jvm|bytecode|virtual machine|run", "JRE = jre|runtime environment|libraries", "JDK = jdk|development kit|compiler|javac|develop", "Platform independent = platform independent|write once|any os|portable"],
    "The JVM executes Java bytecode and makes Java platform independent. The JRE is the JVM plus the standard libraries needed to run programs. The JDK is the JRE plus development tools such as the javac compiler."),
  T("java-string", "Java", "EASY", ["Java"], "Why are Strings immutable in Java? What is the difference between String, StringBuilder and StringBuffer?",
    ["String is immutable = immutab|cannot be changed|new object|unchangeable", "Why = string pool|security|thread safe|thread-safe|hash|cach", "StringBuilder = stringbuilder|mutable|not thread|faster", "StringBuffer = stringbuffer|synchroniz|thread-safe|thread safe"],
    "A String cannot be changed after creation, which allows the string pool, makes it safe as a hash key and thread-safe. StringBuilder is a mutable, faster, non-synchronised alternative for building text; StringBuffer is the synchronised, thread-safe version."),
  T("java-collections", "Java", "MEDIUM", ["Java", "Data Structures"], "What is the difference between ArrayList and LinkedList, and between HashMap and TreeMap?",
    ["ArrayList = arraylist|dynamic array|random access|index", "LinkedList = linkedlist|linked list|insert|delet|node", "HashMap = hashmap|hash|unordered|o(1)|average", "TreeMap = treemap|sorted|red-black|red black|o(log|order"],
    "ArrayList is backed by an array: fast index access, slow middle inserts. LinkedList is a doubly linked list: fast inserts at known nodes, slow access. HashMap is unordered with O(1) average operations; TreeMap keeps keys sorted with O(log n) operations."),
  T("java-exceptions", "Java", "MEDIUM", ["Java"], "Explain exception handling in Java. What is the difference between checked and unchecked exceptions?",
    ["try, catch, finally = try|catch|finally", "Checked = checked|compile time|must handle|ioexception|declare|throws", "Unchecked = unchecked|runtime exception|nullpointer|programming error", "throw vs throws = throw|throws"],
    "Code that may fail goes in try, errors are handled in catch and cleanup runs in finally. Checked exceptions (like IOException) must be handled or declared with throws at compile time; unchecked exceptions (RuntimeException subclasses like NullPointerException) need not be."),
  T("java-gc", "Java", "MEDIUM", ["Java"], "How does garbage collection work in Java?",
    ["Frees unused objects = unreachable|no reference|unused|free|reclaim", "Heap generations = heap|young|old|generation|eden", "Automatic = automatic|jvm|no need|developer does not", "Can request but not force = system.gc|cannot force|not guarantee|finalize|mark and sweep|mark-and-sweep"],
    "The JVM automatically frees heap objects that are no longer reachable. The heap is split into young and old generations so short-lived objects are collected cheaply. Calling System.gc() is only a hint."),
  T("java-spring-di", "Spring Boot", "MEDIUM", ["Spring Boot", "Java"], "What is dependency injection and how does Spring implement it?",
    ["Dependencies supplied from outside = inject|supplied|provided|not create|instead of creating|new keyword", "Loose coupling and testing = coupl|test|mock|flexib", "Spring container = container|ioc|inversion of control|applicationcontext|bean", "Annotations = autowired|@component|@service|constructor injection|annotation"],
    "Dependency injection means an object receives its dependencies instead of creating them, which gives loose coupling and easier testing. Spring's IoC container creates and wires beans, using annotations like @Component and @Autowired, preferably through constructor injection."),

  // ---------- Python ----------
  T("py-list-tuple", "Python", "EASY", ["Python"], "What is the difference between a list, a tuple, a set and a dictionary in Python?",
    ["List = list|mutable|ordered|square", "Tuple = tuple|immutable|fixed", "Set = set|unique|no duplicate|unordered", "Dictionary = dict|key|value|mapping|hash"],
    "A list is ordered and mutable, a tuple is ordered and immutable, a set holds unique unordered items, and a dictionary maps keys to values with fast lookup."),
  T("py-gil", "Python", "HARD", ["Python"], "What is the GIL in Python and how does it affect multithreading?",
    ["One thread runs Python bytecode at a time = one thread|single thread|lock|mutex|global interpreter lock", "CPU-bound limited = cpu-bound|cpu bound|no speed|not parallel|no true parallel", "I/O bound fine = i/o|io-bound|io bound|network|waiting", "Workarounds = multiprocessing|process|asyncio|c extension|numpy"],
    "The Global Interpreter Lock lets only one thread run Python bytecode at a time, so threads do not speed up CPU-bound work. They still help with I/O-bound tasks. Use multiprocessing or native extensions for CPU-bound parallelism."),
  T("py-decorator", "Python", "MEDIUM", ["Python"], "What are decorators and generators in Python?",
    ["Decorator wraps a function = decorator|wrap|@|adds behaviour|behavior|higher-order|higher order", "Use of decorators = logging|timing|auth|cache|before and after", "Generator yields lazily = generator|yield|lazy|one at a time|iterator", "Memory benefit = memory|large|stream|efficient"],
    "A decorator is a function that wraps another to add behaviour such as logging, timing or authentication, applied with @. A generator uses yield to produce values lazily one at a time, saving memory on large sequences."),
  T("py-mutable-default", "Python", "MEDIUM", ["Python"], "What is the difference between a shallow copy and a deep copy in Python?",
    ["Shallow copy = shallow|copies the outer|same inner|references", "Deep copy = deep|copies everything|recursively|independent", "Nested objects = nested|inner|list of list|object inside", "copy module = copy.copy|copy.deepcopy|deepcopy"],
    "A shallow copy duplicates the outer object but shares the nested objects, so changing an inner list affects both. A deep copy recursively copies everything so the copies are independent. Use copy.copy and copy.deepcopy."),

  // ---------- Git, system design, testing, tools ----------
  T("git-merge-rebase", "Git", "MEDIUM", ["Git"], "What is the difference between git merge and git rebase?",
    ["Merge = merge|merge commit|preserves history|branches join", "Rebase = rebase|replay|linear|rewrite|move commits", "Trade-off = history|clean|conflict|shared branch|public|do not rebase", "Linear history = linear|clean history|pull request|feature branch"],
    "Merge combines branches with a merge commit and preserves the real history. Rebase replays your commits on top of another branch for a linear history but rewrites commits, so avoid rebasing shared branches."),
  T("git-basics", "Git", "EASY", ["Git"], "Explain git commit, push, pull and branch. What is a merge conflict?",
    ["Commit = commit|snapshot|local|save", "Push and pull = push|pull|remote|origin|fetch", "Branch = branch|parallel|feature|isolat", "Merge conflict = conflict|same line|resolve|markers|both changed"],
    "A commit saves a snapshot locally, push uploads commits to the remote, pull fetches and merges remote changes, and a branch is an independent line of work. A merge conflict happens when two branches changed the same lines and you must resolve it by hand."),
  T("sd-caching", "System Design", "MEDIUM", ["System Design", "Redis"], "What is caching? Where would you use it and what problems does it bring?",
    ["Stores frequent data for fast access = fast|frequent|store|memory|redis|latency|speed", "Where = database|api|cdn|browser|read-heavy|read heavy", "Invalidation = invalidat|stale|expire|ttl|consisten", "Eviction = evict|lru|lfu"],
    "A cache keeps frequently read data in fast storage such as memory (Redis, CDN, browser) to cut latency and database load. The hard parts are invalidation, stale data and choosing an eviction policy such as LRU."),
  T("sd-load-balancer", "System Design", "MEDIUM", ["System Design"], "What is a load balancer and why is it needed?",
    ["Distributes traffic = distribut|spread|traffic|requests|multiple server", "Availability = availab|fail|health check|redundan|single point", "Scalability = scal|horizontal|add servers", "Algorithms = round robin|least connection|hash|sticky"],
    "A load balancer spreads incoming requests across several servers. That improves scalability, and with health checks it removes failed servers, avoiding a single point of failure. Common strategies are round robin and least connections."),
  T("sd-scalability", "System Design", "HARD", ["System Design"], "How would you scale a web application that is getting slow as users grow?",
    ["Find the bottleneck first = bottleneck|measure|profil|monitor|identify", "Horizontal scaling = horizontal|more server|load balancer|stateless", "Caching = cach|redis|cdn", "Database scaling = index|replica|read replica|shard|partition|query", "Async work = queue|async|background|message"],
    "Measure first to find the bottleneck. Then scale out stateless app servers behind a load balancer, add caching and a CDN, optimise queries and indexes, use read replicas or sharding for the database, and move slow work to background queues."),
  T("test-unit", "Unit Testing", "EASY", ["Unit Testing"], "What is unit testing and why do we write tests?",
    ["Tests a small unit in isolation = unit|small|isolat|single function|one function", "Catches bugs and regressions = bug|regression|catch|break", "Mocks = mock|stub|dependenc", "Tools or AAA = junit|jest|pytest|arrange|assert|test case"],
    "A unit test checks one small piece of code in isolation, using mocks for its dependencies. Tests catch bugs early, protect against regressions and make refactoring safer. Tools include JUnit, Jest and pytest."),
  T("sd-docker", "Docker", "MEDIUM", ["Docker"], "What is Docker and how is a container different from a virtual machine?",
    ["Container packages app and dependencies = package|dependenc|image|environment|portable|works on my machine", "Shares host kernel = share|kernel|host os|lightweight|no guest os", "VM has a full OS = virtual machine|hypervisor|guest|full os|heavy", "Faster and smaller = fast|start|small|resource|efficient"],
    "Docker packages an app with its dependencies into an image that runs as a container anywhere. Containers share the host kernel, so they are lighter and start faster than virtual machines, which each run a full guest OS on a hypervisor."),
  T("sd-microservices", "System Design", "HARD", ["Microservices", "System Design"], "Monolith versus microservices: what are the trade-offs?",
    ["Monolith = monolith|single|one codebase|deploy together|simple", "Microservices = microservice|independent|separate service|own database|small service", "Benefits = scale independently|independent deploy|team|technology|fault isolation", "Costs = complex|network|latency|distributed|consisten|debug|devops|overhead"],
    "A monolith is simpler to build, test and deploy as one unit but scales and changes as a whole. Microservices let teams deploy and scale services independently, but add network latency, distributed data consistency and operational complexity. Start monolithic unless scale demands otherwise."),
  T("sd-url-shortener", "System Design", "HARD", ["System Design", "Database Design"], "How would you design a URL shortener like bit.ly?",
    ["Generate a short unique key = short|key|id|base62|base 62|hash|counter|unique|random", "Store mapping = database|store|mapping|key-value|key value|table", "Redirect = redirect|301|302|lookup", "Scale = cache|read-heavy|read heavy|replica|shard|load balancer", "Handle collisions or expiry = collision|expir|custom alias|analytics"],
    "Generate a unique short key (for example base62 of a counter), store key-to-URL mappings in a database, and redirect on lookup. Reads far outnumber writes, so cache hot keys and use replicas; handle collisions, expiry and analytics."),
  T("algo-two-pointer", "Algorithms", "MEDIUM", ["Algorithms", "Problem Solving"], "How would you find two numbers in a sorted array that add up to a target? Explain your approach and its complexity.",
    ["Two pointers = two pointer|left and right|start and end|both ends|two index", "Move based on the sum = sum|too big|too small|move|increase|decrease", "Linear time = o(n)|linear|single pass|one pass", "Constant space or alternative = o(1)|constant space|hash|set|brute force|o(n2)"],
    "Use two pointers at both ends: if the sum is too small move the left pointer right, if too big move the right pointer left, until the sum matches. It is O(n) time and O(1) space, better than the O(n^2) brute force."),
  T("algo-linked-list-cycle", "Data Structures", "MEDIUM", ["Data Structures", "Algorithms"], "How do you detect a cycle in a linked list?",
    ["Two pointers = two pointer|slow|fast|tortoise|hare|floyd", "Fast moves two steps = two steps|moving two|twice|2x|faster", "Meet if cycle = meet|same node|equal|collide", "Alternative or complexity = hash set|visited|o(n)|o(1)|constant space"],
    "Floyd's algorithm uses a slow pointer moving one step and a fast pointer moving two. If there is a cycle they eventually meet; if the fast pointer reaches null there is none. It takes O(n) time and O(1) space; a visited set also works but uses O(n) space."),

  // ---------- HR and behavioural ----------
  H("hr-intro", "Self-introduction", "EASY", "Tell me about yourself.",
    ["Education and background = college|degree|b.tech|btech|engineering|studying|student|final year|graduat", "Skills and projects = skill|project|built|developed|internship|worked on|learn", "Interest or goal = interested|passion|goal|want to|looking for|aspir|career", "Why this role = role|company|opportunit|position|contribute"],
    "A short, structured answer: who you are and your education, two or three skills or projects that matter for the role, what you are interested in, and why you want this opportunity. About one minute, no life story.",
    "Use a present, past, future structure and keep it to about a minute."),
  H("hr-strength", "Strengths", "EASY", "What is your biggest strength? Give an example.",
    ["Names a specific strength = strength|good at|strong|skilled|quick learner|problem solving|discipline|consisten", "Backs it with an example = for example|for instance|when i|during|once|in my|project", "Shows impact = result|helped|improved|achieved|team|completed|delivered", "Relevant to the job = role|work|job|company|team"],
    "Pick one strength relevant to the role, prove it with a real example, and say what it achieved.",
    "Claiming a strength without a story is the most common mistake."),
  H("hr-weakness", "Weaknesses", "MEDIUM", "What is your biggest weakness?",
    ["Names a real weakness *2 = weakness|struggle|used to|tend to|find it hard|difficult for me|not good at", "Shows awareness = realis|aware|noticed|understand|learned that|feedback", "Shows action to improve = working on|improv|practis|practic|started|course|habit|now i|try to", "Shows progress = result|better|progress|since then|now|improved"],
    "Name a genuine, non-critical weakness, show you noticed it, describe the concrete steps you are taking, and the progress so far.",
    "Do not say 'I work too hard' and do not name a skill the role requires."),
  H("hr-why-company", "Motivation", "EASY", "Why do you want to join our company?",
    ["Knows the company = company|organization|organisation|product|service|culture|known for|work on|technolog", "Links to own skills = my skill|my interest|my background|fit|align|match|experience", "Wants to grow and contribute = learn|grow|contribute|opportunit|impact|challeng", "Specific reasons = because|reason|especially|particularly"],
    "Show you researched the company, connect its work to your skills and interests, and say what you want to learn and contribute.",
    "Read the company's about page and a recent product or blog post before the interview."),
  H("hr-teamwork", "Teamwork", "MEDIUM", "Tell me about a time you worked in a team to achieve a goal.",
    ["Situation = when|during|in my|at college|project|internship|team of|group|hackathon|semester", "Your task or role = my role|i was responsible|my task|i had to|assigned|goal|i took|i handled", "Your action = i led|i built|i organi|i wrote|i coordinated|i suggested|i helped|i decided", "Result = result|outcome|finally|as a result|completed|delivered|won|achieved|improved|%"],
    "Describe the team and goal, your specific role, what you personally did (not only what 'we' did), and the measurable result.",
    "Say 'I' for your own actions; interviewers want to know your contribution."),
  H("hr-conflict", "Conflict resolution", "MEDIUM", "Describe a conflict or disagreement with a teammate and how you handled it.",
    ["Situation = when|during|project|team|teammate|disagree|conflict|argument|different opinion", "Listened and understood the other side *2 = listen|understood|perspective|talked|discuss|conversation|asked", "Acted calmly toward a solution = calm|compromise|agreed|decided|solution|suggested|data shows|using data|mentor|resolve", "Outcome and learning = result|outcome|learn|since then|relationship|worked well|delivered"],
    "Describe a real disagreement, how you listened to the other view, how you reached a solution calmly, the outcome, and what you learned.",
    "Never blame the other person; focus on the problem and the resolution."),
  H("hr-failure", "Handling failure", "MEDIUM", "Tell me about a time you failed. What did you learn?",
    ["Real failure *2 = failed|failure|mistake|did not|didn't|could not|missed|went wrong|rejected|low marks|backlog", "Takes ownership = my fault|i should|i realis|i underestimated|i did not plan|responsib", "Corrective action = after that|so i|next time|started|changed|improved|plan|practis|practic", "Learning = learn|lesson|now i|since then|better"],
    "Share a real failure, own your part, explain what you changed and how you apply the lesson now.",
    "A failure story without a lesson sounds like an excuse."),
  H("hr-leadership", "Leadership", "MEDIUM", "Tell me about a time you led a project or took initiative.",
    ["Situation = when|project|team|club|event|college|hackathon|internship|group", "Took initiative = i led|i organi|i took|i volunteer|i started|i proposed|initiative|i decided|i planned", "Motivated or coordinated others = team|delegat|assign|motivat|coordinat|guided|helped others|members", "Result = result|outcome|completed|delivered|won|achieved|improved|%|participants"],
    "Describe the situation, what you started or led, how you worked with others, and the result with numbers if possible.",
    "Initiative counts even without a title: leading a college event is a valid example."),
  H("hr-pressure", "Working under pressure", "MEDIUM", "How do you handle pressure or tight deadlines? Give an example.",
    ["Example situation = when|deadline|exam|project|submission|last week|once|during", "Prioritise and plan *2 = prioriti|plan|schedule|break down|list|focus|time management|organi", "Stays calm and communicates = calm|communicat|informed|asked for help|team|discuss", "Outcome = result|completed|delivered|on time|submitted|achieved|learn"],
    "Give a concrete deadline story: how you broke the work down and prioritised, communicated, stayed calm, and delivered.",
    "Show a method (prioritise, plan, communicate), not just 'I work well under pressure'."),
  H("hr-5-years", "Career goals", "EASY", "Where do you see yourself in five years?",
    ["Growth in skills = learn|skill|grow|expert|senior|deepen|master|technolog", "Contribution to the team = contribute|responsib|team|lead|impact|value|project", "Realistic and relevant = role|company|engineer|developer|domain|industry", "Ambition = goal|aim|aspire|want to|hope|plan"],
    "Aim to grow into a strong engineer in this domain, take more responsibility and contribute to bigger projects, while learning continuously.",
    "Keep it realistic and connected to the role you are interviewing for."),
  H("hr-challenge", "Problem solving", "MEDIUM", "Describe the most challenging problem you solved. How did you approach it?",
    ["Describes the problem = problem|challenge|bug|issue|difficult|stuck|could not|error", "Approach = first|then|approach|broke|debug|researched|tried|tested|analys|docs|asked", "Technical or specific detail = api|database|code|algorithm|library|framework|server|query|function|deploy", "Outcome and learning = solved|fixed|result|worked|finally|learn|now|reduced|improved|%"],
    "Explain the problem, your step-by-step approach, the specific fix, the result, and what you learned.",
    "Include one concrete technical detail so the story is credible."),
  H("hr-feedback", "Receiving feedback", "EASY", "How do you respond to criticism or feedback? Give an example.",
    ["Example = when|once|my mentor|professor|teammate|reviewer|code review|feedback", "Listened openly *2 = listen|accept|understood|thank|open|not defensive|asked", "Acted on it = changed|improved|applied|fixed|worked on|started|next|updated", "Result = result|better|improved|since then|now|learn"],
    "Give a real example of feedback you received, how you listened without getting defensive, what you changed, and how it helped.",
    "Interviewers look for openness and visible change, not agreement alone."),
  H("hr-why-hire", "Self-pitch", "MEDIUM", "Why should we hire you?",
    ["Skills that match = skill|know|java|python|react|sql|data structure|technical|experience|project", "Proof or example = project|built|developed|internship|achiev|won|certificat|for example|result", "Attitude = learn|quick|dedicat|hard working|team|adapt|passion|reliable", "Value to the company = contribute|value|help|add|company|team|role"],
    "Match two or three of your strongest skills to the role, prove them with a project or result, show attitude (learning, teamwork), and say the value you will add.",
    "Tie every claim to the job description and back it with evidence."),
  H("hr-relocation-shifts", "Flexibility", "EASY", "Are you willing to relocate or work in shifts?",
    ["Clear answer *2 = yes|willing|ready|open to|comfortable|flexible|happy to|can relocate", "Reason or conditions = because|as|so long|provided|if|depends|family|notice", "Positive attitude = opportunit|learn|grow|adapt|experience|new", "Practical readiness = prepared|manage|plan|arrange|support"],
    "Answer clearly and honestly. If you are flexible, say so and why; if you have a constraint, state it politely and give the alternative.",
    "Be honest; a clear answer with a reason is better than a vague yes."),
  H("hr-ethics", "Integrity", "HARD", "Tell me about a time you faced an ethical dilemma or had to say no.",
    ["Situation = when|during|project|team|friend|exam|asked me|pressure|offered", "What was wrong *2 = wrong|unfair|honest|copy|cheat|shortcut|rule|policy|integrity|ethic|plagiar", "Your decision = i decided|i refused|i said no|i told|i reported|i chose|i explained", "Result and reflection = result|outcome|respect|learn|trust|since then|glad"],
    "Describe the dilemma, why it was wrong, what you decided and said, the outcome, and what it shows about your values.",
    "Choose a real, specific example and show that you acted calmly and respectfully."),
  H("hr-time-management", "Time management", "EASY", "How do you manage your time when you have many tasks?",
    ["Prioritises = prioriti|important|urgent|deadline|first", "Uses a method = list|schedule|calendar|plan|todo|to-do|planner|tool|trello|notion|break down", "Example = for example|e.g|during|last semester|exam|project|once", "Result = result|completed|on time|manage|balance|achieved"],
    "Explain how you list and prioritise tasks by deadline and importance, the tool or routine you use, and a real example where it worked.",
    "A named method plus one concrete example is far stronger than general statements."),
];

export const INTERVIEW_BY_ID = new Map(INTERVIEW_QUESTIONS.map((q) => [q.id, q]));
