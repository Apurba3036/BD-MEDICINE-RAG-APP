export const healthTips = [
  {
    id: 1,
    title: "Eat a healthy diet",
    source: "WHO",
    content: "Eat a combination of different foods, including fruit, vegetables, legumes, nuts and whole grains. Adults should eat at least five portions (400g) of fruit and vegetables per day. By eating healthy, you will reduce your risk of malnutrition and noncommunicable diseases (NCDs) such as diabetes, heart disease, stroke and cancer."
  },
  {
    id: 2,
    title: "Consume less salt and sugar",
    source: "WHO",
    content: "Reduce your salt intake to 5g per day, equivalent to about one teaspoon. On the other hand, consuming excessive amounts of sugars increases the risk of tooth decay and unhealthy weight gain. WHO recommends consuming less than 5% of total energy intake from free sugars."
  },
  {
    id: 3,
    title: "Reduce intake of harmful fats",
    source: "WHO",
    content: "Fats consumed should be less than 30% of your total energy intake. This will help prevent unhealthy weight gain and NCDs. Prefer unsaturated fats (found in fish, avocado, nuts, sunflower oil) over saturated fats and trans-fats (found in baked/fried foods)."
  },
  {
    id: 4,
    title: "Don’t smoke",
    source: "WHO",
    content: "Smoking tobacco causes NCDs such as lung disease, heart disease and stroke. Tobacco kills not only the direct smokers but even non-smokers through second-hand exposure. If you are currently a smoker, it’s not too late to quit."
  },
  {
    id: 5,
    title: "Be active",
    source: "WHO",
    content: "Physical activity includes exercise and activities undertaken while working, playing, carrying out household chores, travelling, and engaging in recreational pursuits. Adults aged 18-64 years should do at least 150 minutes of moderate-intensity physical activity throughout the week."
  },
  {
    id: 6,
    title: "Check your blood pressure regularly",
    source: "WHO",
    content: "Hypertension, or high blood pressure, is called a 'silent killer' because many people may not be aware of the problem as it may not have any symptoms. Have your blood pressure checked regularly by a health worker so you know your numbers."
  },
  {
    id: 7,
    title: "Follow traffic laws",
    source: "WHO",
    content: "Road crashes claim over one million lives around the world. You can prevent road crashes by ensuring that you follow traffic laws such as using the seatbelt, wearing a helmet when riding a motorcycle or bicycle, not drinking and driving, and not using your mobile phone while driving."
  },
  {
    id: 8,
    title: "Take antibiotics only as prescribed",
    source: "WHO",
    content: "Antibiotic resistance is one of the biggest public health threats in our generation. Make sure you only take antibiotics if prescribed by a qualified health professional. And once prescribed, complete the treatment days as instructed. Never share antibiotics."
  },
  {
    id: 9,
    title: "Clean your hands properly",
    source: "WHO",
    content: "Hand hygiene is critical not only for health workers but for everyone. Clean hands can prevent the spread of infectious illnesses. You should handwash using soap and water when your hands are visibly soiled or handrub using an alcohol-based product."
  },
  {
    id: 10,
    title: "Have regular check-ups",
    source: "WHO",
    content: "Regular check-ups can help find health problems before they start. Health professionals can help find and diagnose health issues early, when your chances for treatment and cure are better. Go to your nearest health facility to check out the health services."
  },
  {
    id: 11,
    title: "Choose whole grains more often",
    source: "NIH/NIDDK",
    content: "Try whole-wheat breads and pastas, oatmeal, or brown rice. Whole grains provide more nutrients and fiber than refined grains, which helps keep you full and supports digestive health."
  },
  {
    id: 12,
    title: "Select a mix of colorful vegetables",
    source: "NIH/NIDDK",
    content: "Vegetables of different colors provide a variety of nutrients. Try dark, leafy greens—such as spinach, kale, collards—and red and orange vegetables such as carrots, sweet potatoes, red peppers, and tomatoes. Eat a rainbow of food colors!"
  },
  {
    id: 13,
    title: "At restaurants, eat only half of your meal",
    source: "NIH/NIDDK",
    content: "Restaurant portions are often much larger than what you need. Ask for smaller servings, or at a restaurant, consume only half your meal and take the rest home. This helps you manage your caloric intake."
  },
  {
    id: 14,
    title: "Get adequate sleep",
    source: "NIH/NIDDK",
    content: "In general, people who get too little sleep tend to weigh more than those who get enough sleep. Sleep-deprived people may be too tired to exercise and lack of sleep may also disrupt the balance of hormones that control appetite."
  },
  {
    id: 15,
    title: "Shift from solid fats to oils",
    source: "NIH/NIDDK",
    content: "Try cooking with vegetable, olive, canola, or peanut oil instead of solid fats such as butter, stick margarine, shortening, lard, or coconut oil. Choose foods that naturally contain oils, such as seafood and nuts."
  },
  {
    id: 16,
    title: "Switch from frying to baking or grilling",
    source: "NIH/NIDDK",
    content: "Instead of fried chicken, try a salad topped with grilled chicken. Instead of ordering fries when eating out, ask for a side of steamed veggies. Making better choices can help you cut down on added sugars and solid fats."
  },
  {
    id: 17,
    title: "Do muscle-strengthening activities",
    source: "NIH/NIDDK",
    content: "Strength training works your muscles by making you push or pull against something. Try lifting weights, doing push-ups, or using resistance bands at least 2 days a week to maintain muscle mass and bone strength."
  },
  {
    id: 18,
    title: "Understand your eating triggers",
    source: "NIH/NIDDK",
    content: "Sometimes people snack, eat, or drink more when they feel bored, sad, angry, happy, or stressed—even when they are not hungry. Consider whether it might be your emotions making you want to eat, and try doing something else to cope."
  },
  {
    id: 19,
    title: "Be realistic about weight-loss goals",
    source: "NIH/NIDDK",
    content: "Aim for a slow, modest weight loss of 5 to 10 percent of your starting weight over a period of 6 months. Modest weight loss has been shown to improve health, and it may bring you other benefits such as better mood and more energy."
  },
  {
    id: 20,
    title: "Be good to yourself to relieve stress",
    source: "NIH/NIDDK",
    content: "Stress can cause you to overeat, feel tired, and not want to be active. Try a new hobby or any activity that sparks your interest. Surround yourself with people whose company you enjoy to offset the effects of stress."
  }
];

export const getDailyTip = () => {
  // Use the current day of the year to pick a tip so it changes daily
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  
  const index = dayOfYear % healthTips.length;
  return healthTips[index];
};
