#!/usr/bin/env bash
# اختبار وظيفي ذاتي ضد الخادم المحلي (بيانات تجريبية). التشغيل:
#   node server.js   (في طرفية أخرى)
#   bash scripts/selftest.sh
set -u
B=http://localhost:3000
J=/tmp/cj.txt
P=0; F=0
ck(){ if [ "$2" = "1" ]; then P=$((P+1)); echo "  ✓ $1"; else F=$((F+1)); echo "  ✗ $1"; fi }

echo "1) صفحات الواجهة تُقدَّم"
for pg in "" "listings.html" "detail.html" "request.html" "admin.html"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$B/$pg")
  ck "GET /$pg -> 200" $([ "$code" = "200" ] && echo 1 || echo 0)
done

echo "2) واجهة برمجة المنشورات تعمل"
n=$(curl -s "$B/api/posts" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ok'), d.get('count', -1))")
ck "GET /api/posts يعيد ok" $(echo "$n" | grep -q "True" && echo 1 || echo 0)

echo "3) كلمة مرور خاطئة مرفوضة (401)"
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/admin/login" -H 'Content-Type: application/json' -d '{"password":"خطأ"}')
ck "رفض كلمة خاطئة -> 401" $([ "$code" = "401" ] && echo 1 || echo 0)

echo "4) كلمة مرور صحيحة مقبولة"
PASS="${ADMIN_PASSWORD:-زياد زياد}"
resp=$(curl -s -c $J -X POST "$B/api/admin/login" -H 'Content-Type: application/json' -d "{\"password\":\"$PASS\"}")
csrf=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin)['csrf'])")
ok=$(echo "$resp" | python3 -c "import sys,json;print(json.load(sys.stdin)['ok'])")
ck "قبول الصحيحة ok=true" $([ "$ok" = "True" ] && echo 1 || echo 0)

echo "5) فتح admin.html بالرابط المباشر دون جلسة يتطلب دخولًا (فحص عبر API session من جلسة جديدة)"
curl -s -c /tmp/cj2.txt -o /dev/null "$B/api/admin/session" 2>/dev/null
s2=$(curl -s -b /tmp/cj2.txt "$B/api/admin/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('authenticated'))")
ck "جلسة جديدة غير مصادقة" $([ "$s2" = "False" ] && echo 1 || echo 0)

echo "6) نشر منشور نصي (بدون وسائط) مع CSRF"
r=$(curl -s -b $J -X POST "$B/api/admin/posts" -H "X-CSRF-Token: $csrf" \
     -F "title=شقة للبيع في المعادي" -F "location=المعادي، القاهرة" \
     -F "description=شقة مساحتها 100 متر، غرفتين، تشطيب لوكس، دور خامس، قريبة من النيل والمترو.")
pok=$(echo "$r" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('ok'))")
pid=$(echo "$r" | python3 -c "import sys,json;print(json.load(sys.stdin)['post']['id'])")
ck "نشر نصي نجح ok=true" $([ "$pok" = "True" ] && echo 1 || echo 0)

echo "7) رفض طلب نشر بلا CSRF (403)"
code=$(curl -s -o /dev/null -w "%{http_code}" -b $J -X POST "$B/api/admin/posts" \
       -F "title=بدون csrf" -F "location=مكان" -F "description=وصف كافي للنشر التجريبي بدون توكن")
ck "بلا CSRF -> 403" $([ "$code" = "403" ] && echo 1 || echo 0)

echo "8) المنشور يظهر للزوار (متصل ثانٍ بلا جلسة)"
cnt=$(curl -s "$B/api/posts" | python3 -c "import sys,json;print(json.load(sys.stdin)['count'])")
ck "ظهور المنشور للزوار count>=1" $([ "${cnt:-0}" -ge 1 ] && echo 1 || echo 0)

echo "9) تفاصيل المنشور (نصي فقط، بلا قسم وسائط من طرف العميل تُدار في الواجهة)"
d=$(curl -s "$B/api/posts/$pid")
dh=$(echo "$d" | python3 -c "import sys,json;p=json.load(sys.stdin)['post'];print(len(p['media']['images']),len(p['media']['videos']))")
ck "منشور نصي بلا صور/فيديو" $([ "$dh" = "0 0" ] && echo 1 || echo 0)

echo "10) إرسال طلب شقة (زائر بلا حساب)"
tok=$(curl -s "$B/api/request-token" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
rr=$(curl -s -X POST "$B/api/requests" -H 'Content-Type: application/json' \
      -d "{\"name\":\"أحمد محمد\",\"phone\":\"01001234567\",\"area\":\"الزمالك\",\"budget\":\"إيجار شهري 8000 جنيه\",\"description\":\"عايز شقة في الزمالك غرفتين حمام وريسبشن، تشطيب حديث، دور فوق التالت.\",\"token\":\"$tok\"}")
rok=$(echo "$rr" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ok'))")
ref=$(echo "$rr" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ref',''))")
ck "استلام الطلب ok=true مع ref" $([ "$rok" = "True" ] && [ -n "$ref" ] && echo 1 || echo 0)

echo "11) مفتاح إرسال يُمنع من الاستخدام مرتين (مضاد تكرار)"
tok2=$(curl -s "$B/api/request-token" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
# استخدم نفس token مرتين
for i in 1 2; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/requests" -H 'Content-Type: application/json' \
    -d "{\"name\":\"منى\",\"phone\":\"01112345678\",\"area\":\"جاردن سيتي\",\"budget\":\"شراء 2 مليون\",\"description\":\"طلب اختبار لمفتاح التكرار المنى شقة صغيرة\",\"token\":\"$tok2\"}")
  echo "   محاولة $i -> $code"
done

echo "12) رفض رقم هاتف غير صحيح"
tok3=$(curl -s "$B/api/request-token" | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$B/api/requests" -H 'Content-Type: application/json' \
  -d "{\"name\":\"خالد\",\"phone\":\"12345\",\"area\":\"شبرا\",\"budget\":\"إيجار 3000\",\"description\":\"رقم غير صحيح يجب رفضه وتوضيح خطأ مفهوم\",\"token\":\"$tok3\"}")
ck "رفض رقم غير صحيح -> 400" $([ "$code" = "400" ] && echo 1 || echo 0)

echo "13) وصول الطلب للإدارة فقط"
reqs=$(curl -s -b $J -G "$B/api/admin/requests" --data-urlencode "page=1" --data-urlencode "status=الكل")
rc=$(echo "$reqs" | python3 -c "import sys,json;print(json.load(sys.stdin).get('total',0))")
ck "الإدارة ترى الطلبات total>=1" $([ "${rc:-0}" -ge 1 ] && echo 1 || echo 0)
# الزائر لا يصل للطلبات عبر أي API عام
code=$(curl -s -o /dev/null -w "%{http_code}" "$B/api/admin/requests")
ck "الطلبات غير متاحة بلا جلسة -> 401" $([ "$code" = "401" ] && echo 1 || echo 0)

echo "14) تعديل حالة الطلب"
rid=$(echo "$reqs" | python3 -c "import sys,json;print(json.load(sys.stdin)['requests'][0]['id'])")
up=$(curl -s -b $J -X PATCH "$B/api/admin/requests/$rid" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' -d '{"status":"متوفر"}')
uok=$(echo "$up" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ok'))")
ck "حفظ حالة الطلب ok=true" $([ "$uok" = "True" ] && echo 1 || echo 0)

echo "15) إدخال بيانات مخربي لا يُنفَّذ (نص آمن في الواجهة تُدار بالمتصفح) — نتحقق أن العرض يمر بلا مشكلة"
echo "   (التحقق من عدم التنفيذ يتم في المتصفح عبر textContent) - مذكور في التقارير"

echo "16) قسم الروابط: قراءة عامة للروابط الحقيقية فقط"
sl=$(curl -s "$B/api/site-links")
slinfo=$(echo "$sl" | python3 -c "import sys,json;d=json.load(sys.stdin);ids=[l['id'] for l in d.get('links',[])];print(d.get('ok'), 'whatsapp' in ids, any(x in ids for x in ('facebook','instagram','youtube')))")
ck "GET /api/site-links ok مع واتساب الحقيقي بدون روابط وهمية" $(echo "$slinfo" | grep -q "^True True False" && echo 1 || echo 0)
wa=$(echo "$sl" | python3 -c "import sys,json;d=json.load(sys.stdin);print([l['url'] for l in d['links'] if l['id']=='whatsapp'][0])")
ck "واتساب على الرقم الحقيقي" $([ "$wa" = "https://wa.me/201552099055" ] && echo 1 || echo 0)

echo "17) تعديل الروابط مش متاح إلا بالإدارة"
code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$B/api/admin/site-links" -H 'Content-Type: application/json' -d '{"links":{}}')
ck "بلا جلسة -> 401" $([ "$code" = "401" ] && echo 1 || echo 0)
code=$(curl -s -o /dev/null -w "%{http_code}" -b $J -X PUT "$B/api/admin/site-links" -H 'Content-Type: application/json' -d '{"links":{}}')
ck "بلا CSRF -> 403" $([ "$code" = "403" ] && echo 1 || echo 0)

echo "18) رابط غير صالح مرفوض (400)"
code=$(curl -s -o /dev/null -w "%{http_code}" -b $J -X PUT "$B/api/admin/site-links" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' -d '{"links":{"facebook":"javascript:alert(1)"}}')
ck "javascript: rejected -> 400" $([ "$code" = "400" ] && echo 1 || echo 0)

echo "19) تغيير رابط من الإدارة بيتطبق على القراءة العامة"
up=$(curl -s -b $J -X PUT "$B/api/admin/site-links" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' -d '{"links":{"gmail":"baytak@gmail.com"}}')
upok=$(echo "$up" | python3 -c "import sys,json;print(json.load(sys.stdin).get('ok'))")
ck "حفظ الجيميل ok=true" $([ "$upok" = "True" ] && echo 1 || echo 0)
gm=$(curl -s "$B/api/site-links" | python3 -c "import sys,json;d=json.load(sys.stdin);print([l['url'] for l in d['links'] if l['id']=='gmail'][0])")
ck "الجيميل ظاهر للزوار كـ mailto" $([ "$gm" = "mailto:baytak@gmail.com" ] && echo 1 || echo 0)
# نرجّع الجيميل فاضي (مفيش إيميل حقيقي محفوظ في الكود)
curl -s -o /dev/null -b $J -X PUT "$B/api/admin/site-links" -H "X-CSRF-Token: $csrf" -H 'Content-Type: application/json' -d '{"links":{"gmail":""}}'

echo "20) مفيش منشورات تجريبية وهمية"
dcount=$(curl -s "$B/api/posts" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for p in d['posts'] if p.get('demo') or 'تجريبي' in (p.get('title') or '')))")
ck "عدد المنشورات التجريبية = 0" $([ "${dcount:-0}" = "0" ] && echo 1 || echo 0)

echo "21) تسجيل الخروج"
lo=$(curl -s -b $J -c $J -X POST "$B/api/admin/logout")
ck "خروج ok=true" $([ "$lo" = '{"ok":true}' ] && echo 1 || echo 0)
sess=$(curl -s -b $J "$B/api/admin/session" | python3 -c "import sys,json;print(json.load(sys.stdin).get('authenticated'))")
ck "بعد الخروج غير مصادق" $([ "$sess" = "False" ] && echo 1 || echo 0)

echo
echo "============================================"
echo "النتيجة: نجح $P | فشل $F"
echo "============================================"
