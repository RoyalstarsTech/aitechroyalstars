// Pre-test (set A) and post-test (set B): same 15 topics, same difficulty, different wording.
// "a" is the index (0-3) of the correct option. Edit text here; keep 4 options per question.
export const TOPICS = [
  'AI safety', 'Street Prompt', 'Improving AI answers', 'Money calendar', 'Complaints to customers',
  'Status Market Day', 'Being found by AI', 'Testing an idea', 'Replying "How much?"', 'Handling "Last price?"',
  'Small, medium, big', 'Pricing', 'Daily profit', 'Fake bank alerts', 'Keeping customers'];

export const SETS = {
  pre: [
    { q: 'Which of these should you NEVER type into an AI app?', o: ['Your product prices', 'Your bank PIN or BVN', 'Your business area', 'A description of your product'], a: 1 },
    { q: 'Which message to AI will give the most useful answer?', o: ['"Write something for my business."', '"Help me."', '"I sell shoes in Wuse. Write a short, friendly WhatsApp status for working men."', '"Advert please."'], a: 2 },
    { q: 'AI gives you an answer that is too long and has big English. What is the best next step?', o: ['Delete the app', 'Reply: "Make it shorter and use simpler English."', 'Post it as it is', 'Start a new chat and type the same thing'], a: 1 },
    { q: 'When do many Nigerian workers usually have the most money to spend?', o: ['Around the 10th–20th of the month', 'From about the 25th to the 5th (salary week)', 'Only in January', 'During school resumption'], a: 1 },
    { q: 'Customers often complain that sellers in your line of business deliver late. What is the smart move?', o: ['Ignore it — it is not your problem', 'Promise and keep fast, on-time delivery, and tell customers about it', 'Increase your price', 'Stop delivering'], a: 1 },
    { q: 'In "Status Market Day", what should your afternoon status usually show?', o: ['Proof — a happy customer message (with permission) or a delivery picture', 'Nothing — post only once a day', 'A long story about your life', 'A screenshot of your bank balance'], a: 0 },
    { q: 'What gives you the best chance of AI apps recommending your business correctly?', o: ['Paying someone to "hack" Google', 'Clear, correct details that are the same on all your pages', 'Changing your business name often', 'Posting only at night'], a: 1 },
    { q: 'You have a new business idea but little money. What should you do first?', o: ['Borrow money and buy plenty of stock', 'Test it cheaply in 7 days — ask people and take pre-orders', 'Wait until you have ₦1 million', 'Print 1,000 flyers'], a: 1 },
    { q: 'A customer asks "How much?" for a dress. Which reply is best?', o: ['"₦8,500."', '"Check my status."', '"₦8,500. It\'s pure cotton. What size do you wear?"', 'No reply until they ask again'], a: 2 },
    { q: 'A customer says "Last price?" What is a smart reply?', o: ['Cut the price until there is no profit', '"That\'s my best price, but I\'ll add free delivery today."', 'Block the customer', '"Go and buy elsewhere."'], a: 1 },
    { q: 'You offer small, medium and big options. Which one do most customers choose?', o: ['The small one', 'The middle one', 'The big one', 'None of them'], a: 1 },
    { q: 'A tray of small chops costs you ₦9,000 to make and you want ₦4,000 profit. What is your selling price?', o: ['₦9,000', '₦4,000', '₦13,000', '₦5,000'], a: 2 },
    { q: 'How do you find today\'s profit?', o: ['Total sales today', 'Money in your account', 'Sales minus the cost of what you sold minus today\'s expenses', 'Sales plus expenses'], a: 2 },
    { q: 'A buyer shows you a bank-alert screenshot and wants to take the goods now. What should you do?', o: ['Release the goods — the screenshot is enough', 'Confirm the money in your own bank app first', 'Ask them to send the screenshot again', 'Ask for their BVN'], a: 1 },
    { q: 'Which is usually cheaper for a business?', o: ['Finding a brand-new customer', 'Keeping an old customer coming back', 'Both cost the same', 'Running TV adverts'], a: 1 },
  ],
  post: [
    { q: 'Which of these is SAFE to share with an AI app?', o: ['Your bank password', 'Your BVN', 'Your product name and price list', 'Your customers\' phone numbers'], a: 2 },
    { q: 'Which of these follows the Street Prompt?', o: ['"Write advert."', '"I sell small chops in Kubwa. Help me write a weekend offer for party planners. Make it short."', '"Do my business."', '"Hello AI."'], a: 1 },
    { q: 'You want better answers from AI. Which reply helps most?', o: ['"Wrong."', '"Ask me questions first about my business."', '"Try again" with no details', 'Closing the app'], a: 1 },
    { q: 'You sell food in an office area. When should you plan your best offer?', o: ['Around salary week (about the 25th–5th)', 'The middle of the month only', 'When school fees are due', 'Never — offers waste money'], a: 0 },
    { q: 'People complain about rude replies from sellers like you. How do you turn this into customers?', o: ['Reply rudely too', 'Make polite, fast replies your promise — and keep it', 'Stop replying to messages', 'Copy your competitor\'s prices'], a: 1 },
    { q: 'In "Status Market Day", what is a good evening status?', o: ['An offer or tip, e.g. "Order before 9pm, get free delivery tomorrow."', 'Your bank account balance', 'A blank picture', 'The same post as the morning'], a: 0 },
    { q: 'You ask AI "Where can I buy cakes in Gwarinpa?" and your shop is not mentioned. What should you work on?', o: ['Complain to AI', 'Make your business name, area, phone and prices clear and the same everywhere, and get reviews', 'Change your business name every week', 'Nothing — it cannot change'], a: 1 },
    { q: 'A student wants to start a laundry service on campus. What is the best first step?', o: ['Buy 3 washing machines', 'Ask 20 people, post "coming soon" and take pre-orders before spending', 'Register a company first', 'Rent a big shop'], a: 1 },
    { q: 'Someone asks "How much is this bag?" Which reply follows the Price Talk method?', o: ['"Price is on my page."', '"₦12,000. It\'s real leather. Is it for you or a gift?"', '"Very cheap."', '"DM."'], a: 1 },
    { q: 'A customer keeps saying "Abeg reduce am". What should you avoid?', o: ['Showing the value of the product', 'Offering a smaller option', 'Cutting your price until your profit is zero', 'Being polite'], a: 2 },
    { q: 'Why should you make your middle package your best deal?', o: ['Because most customers pick the middle option', 'Because nobody buys the middle option', 'Because it is the cheapest', 'It makes no difference'], a: 0 },
    { q: 'Your profit is ₦4,000 per tray. How many trays must you sell to make ₦100,000 profit this month?', o: ['10 trays', '25 trays', '40 trays', '100 trays'], a: 1 },
    { q: 'Today you sold ₦50,000. The goods cost you ₦30,000 and you spent ₦5,000 on transport and data. What is your profit?', o: ['₦50,000', '₦20,000', '₦15,000', '₦45,000'], a: 2 },
    { q: 'What is the safest rule against fake bank alerts?', o: ['Trust SMS alerts', 'Trust screenshots from regular customers', 'Never release goods until you confirm payment in your bank app or with your bank', 'Ask the buyer to call your bank for you'], a: 2 },
    { q: 'What is the best way to bring an old customer back after 2–3 months?', o: ['Wait for them to remember you', 'Send a friendly "we miss you" message with a small offer', 'Post their name on your status', 'Call them 10 times a day'], a: 1 },
  ],
};

export const CONFIDENCE = [
  'How confident are you using AI on your phone to write a sales message?',
  'How confident are you replying to "How much?" and closing the sale?',
  'How confident are you keeping records of sales, debts and profit?',
];

export const publicSet = (which) => (SETS[which] || []).map((x, i) => ({ n: i + 1, topic: TOPICS[i], q: x.q, o: x.o }));
