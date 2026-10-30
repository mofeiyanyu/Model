/**
 * 多网盘公开聚合搜索 - Rex Widget
 * 覆盖：夸克、阿里、百度、115、天翼、UC、迅雷、123、PikPak、磁力等
 * 无需密码，纯公开接口
 */
var WidgetMetadata = {
  id: "pan.public.search",
  title: "全网盘公开搜索",
  description: "聚合公开网盘资源（夸克/阿里/百度/115/天翼/UC/迅雷/123/PikPak/磁力等），无需密码",
  author: "Grok",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  site: "https://github.com/fish2018/pansou",
  modules: [
    {
      id: "search",
      title: "网盘搜索",
      description: "输入关键词搜索全网公开网盘资源",
      functionName: "searchPan",
      cacheDuration: 300,
      params: [
        {
          name: "kw",
          title: "关键词",
          type: "input",
          description: "电影/剧集/资源名称",
          value: ""
        },
        {
          name: "cloud_type",
          title: "网盘类型",
          type: "enumeration",
          value: "all",
          enumOptions: [
            { title: "全部", value: "all" },
            { title: "夸克", value: "quark" },
            { title: "阿里云盘", value: "aliyun" },
            { title: "百度网盘", value: "baidu" },
            { title: "115", value: "115" },
            { title: "天翼云盘", value: "tianyi" },
            { title: "UC网盘", value: "uc" },
            { title: "迅雷", value: "xunlei" },
            { title: "123云盘", value: "123" },
            { title: "PikPak", value: "pikpak" },
            { title: "磁力", value: "magnet" }
          ]
        }
      ]
    }
  ],
  search: {
    title: "全网盘搜索",
    functionName: "searchPan",
    params: [
      {
        name: "kw",
        title: "关键词",
        type: "input",
        value: ""
      }
    ]
  }
};

// 可配置的公开 PanSou 地址（可自行替换为自己部署的实例）
var PANSOU_BASE = "https://so.252035.xyz";

// 网盘中文名映射
var CLOUD_NAME = {
  quark: "夸克",
  aliyun: "阿里云盘",
  baidu: "百度网盘",
  "115": "115网盘",
  tianyi: "天翼云盘",
  uc: "UC网盘",
  xunlei: "迅雷",
  "123": "123云盘",
  pikpak: "PikPak",
  mobile: "移动云盘",
  magnet: "磁力",
  ed2k: "电驴",
  others: "其他"
};

/**
 * 搜索主函数
 */
async function searchPan(params) {
  var kw = (params.kw || params.keyword || params.q || "").trim();
  if (!kw) return [];

  var cloudType = (params.cloud_type || "all").toLowerCase();

  try {
    // 优先 GET，兼容性好
    var url = PANSOU_BASE + "/api/search?kw=" + encodeURIComponent(kw) +
              "&res=merge&src=all";

    if (cloudType && cloudType !== "all") {
      url += "&cloud_types=" + encodeURIComponent(cloudType);
    }

    var resp = await Widget.http.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
        "Accept": "application/json"
      },
      timeout: 25000
    });

    var data = typeof resp.data === "string" ? JSON.parse(resp.data) : resp.data;
    if (!data) return [];

    var items = [];
    var seen = {};

    // 优先使用 merged_by_type（按网盘分类合并后的结果）
    if (data.merged_by_type) {
      for (var type in data.merged_by_type) {
        if (cloudType !== "all" && type !== cloudType) continue;
        var list = data.merged_by_type[type] || [];
        for (var i = 0; i < list.length; i++) {
          var r = list[i];
          pushItem(items, seen, r, type);
        }
      }
    }

    // 兜底：使用 results 原始结果
    if (items.length === 0 && data.results && data.results.length) {
      for (var j = 0; j < data.results.length; j++) {
        var item = data.results[j];
        var links = item.links || [];
        for (var k = 0; k < links.length; k++) {
          var link = links[k];
          var t = link.type || "others";
          if (cloudType !== "all" && t !== cloudType) continue;
          pushItem(items, seen, {
            url: link.url,
            password: link.password || "",
            note: item.title || item.content || "",
            datetime: item.datetime,
            source: item.channel || item.source || "",
            images: item.images
          }, t);
        }
      }
    }

    return items;
  } catch (e) {
    console.log("PanSou search error:", e);
    return [];
  }
}

/**
 * 统一推入 VideoItem
 */
function pushItem(items, seen, r, type) {
  var url = (r.url || "").trim();
  if (!url || seen[url]) return;
  seen[url] = true;

  var name = CLOUD_NAME[type] || type || "网盘";
  var title = (r.note || r.title || "未命名资源").trim();
  var pwd = (r.password || "").trim();
  var descParts = ["【" + name + "】"];
  if (pwd) descParts.push("提取码: " + pwd);
  if (r.source) descParts.push("来源: " + r.source);
  if (r.datetime) descParts.push(r.datetime.substring(0, 10));

  var cover = null;
  if (r.images && r.images.length) cover = r.images[0];

  items.push({
    id: url,
    type: "url",
    title: title,
    description: descParts.join(" · "),
    coverUrl: cover,
    videoUrl: url,          // 网盘分享链接
    link: url,
    // 部分客户端会识别 password 字段
    password: pwd || undefined
  });
}