في apps/app/app/(tabs)/_layout.tsx الموجود عندك فعليًا، لا تستبدله — فقط:

1) أضف هذا الاستيراد في الأعلى:

   import { Header } from "@/components/Header";

2) داخل <Tabs screenOptions={{ ... }}> الموجودة، أضف مفتاح header:

   <Tabs
     screenOptions={{
       header: () => <Header />,
       // ...بقية الإعدادات الموجودة عندك كما هي (tabBarActiveTintColor، إلخ)
     }}
   >

هذا كل التعديل المطلوب على ذلك الملف — Header سيظهر تلقائيًا فوق كل شاشات الـ tabs
الخمس (الرئيسية، المتاجر، الطلبات، المفضلة، حسابي)، تمامًا مثل ظهور <Header /> في
web/src/app/layout.tsx فوق كل صفحة.

ملاحظتان:
- استخدمت "bag-outline" من Ionicons بدل ShoppingBag من lucide (lucide-react غير
  متوفرة في React Native؛ @expo/vector-icons هي المكتبة المستخدمة أصلاً في مشروعك).
- خط اللوجو "cyberjunkies" المستخدم في الويب هو خط مخصص غير محمّل حاليًا في التطبيق
  — استخدمت مؤقتًا Cairo الغامق (fonts.headingExtrabold) بدلاً منه. إذا عندك ملف
  الخط (.ttf/.otf)، أخبرني وأضيفه عبر useFonts في app/_layout.tsx.
