# 深色写信文字的屏幕绘制（2026-11-06）

**当前采用多色版c3a898，而不是下文的统一浅灰试验19e7。**
用户在实际使用后补充要求保留签名颜色并修复黑caret，已按最后要求完成。

用户选择保持深色纸面、只在屏幕上提亮文字，之后明确认可已有邮件的文字观感，
允许统一显示为一个颜色。实际发送、保存的HTML和签名颜色继续保留原值。
本次不调整显示器亮度、HDR设置、字体或字号。

## 实现

目标静态软件`cef4delphi/libcef.dll`版本为
`126.0.0+g03dfd39+chromium-126.0.6478.270`，支持CSS Custom Highlight API。
`editor-screen-ink.js`仅为富文本和纯文本编辑DIV的真实Text节点建立Range，
通过`CSS.highlights`在屏幕绘制柔和浅灰`#d8d8d8`。
不读取文本内容，不改正文DOM、普通元素计算颜色、当前格式或选区，不接管剪贴板。
Text节点专用范围排除图片；MutationObserver在微任务中维护追加/替换后的范围，
WeakMap复用Range。打印前撤销注册，打印后恢复；CSS LINK另限定screen媒体。

`compose-screen-ink.cjs`只给现有UTF-16LE HtmlEditor外壳增加head LINK与nonce脚本。
不添加STYLE：原生GetTextAndHtml会导出首个STYLE，必须保留。
原外壳SHA256为`dd712386a5282d14c6a509598cdf47eb1b502bc966ca3f5eaab59b3620902501`，
候选为`19e7ea18246b0a668f4ef3d842789e4cde9ef73e8e4552f74d769e5753d037d2`。
EXE233e、helper0e47、Base.css8e56与现有打印模板均不替换。

没有采用普通元素`color`或`-webkit-text-fill-color`覆盖。
Chromium编辑样式会保存computed text-fill，可能经编辑或复制序列化进入正文。
Custom Highlight是独立绘制层；普通元素样式采集使用`kPseudoIdNone`，
不会把`::highlight`规则作为普通元素author样式合并。
依据：[Custom Highlight规范](https://drafts.csswg.org/css-highlight-api-1/)、
[Chromium StyleResolver](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/css/resolver/style_resolver.cc)、
[编辑样式实现](https://raw.githubusercontent.com/chromium/chromium/main/third_party/blink/renderer/core/editing/editing_style.cc)。

## 验证和实际状态

`verify-compose-screen-ink.cjs`使用已安装Edge的独立headless profile、纯合成资料，
加载真实静态jquery、FoxUtils、editor-base、compose与body模板。
12种实际GetTextAndHtml导出组合及6类原生编辑命令开/关对照完全相同：
输入、换行、设置前景色、插入带格式HTML、撤销和加粗。
正文HTML、元素计算颜色、foreColor命令值、首STYLE及导出对象均一致；
追加末端文字进入范围，图片不与范围相交，打印前后撤注册/恢复通过。
没有操作系统剪贴板、真实邮件、账户或签名数据访问。

22:51通过`install-compose-screen-ink.ps1`安装模板并正常重开。
只读窗口数值确认主窗与写信窗均DPI120。安装入口有固定hash及源码/测试守卫，
支持`-Preflight`、`-Rollback -Preflight`及`-Rollback`。
目标CEF的实际视觉、键入与选中表现待用户确认；尚未进行原生CF_HTML/实际拖放测试。
API不改变实际元素样式，剪贴板隔离依据是上述源码，不把它冒称实测。

caret保留应用原定义，Highlight不支持caret-color；生成内容与列表标记不是Text节点，
可能继续保留原色，遇到后单独处理。参见[高亮属性规范](https://drafts.csswg.org/css-pseudo-4/#highlight-styling)。

## 统一浅灰候选撤回及新报错

用户确认文字舒服，但光标黑色难看清、彩色签名被统一为灰色，因此要求参考成熟
浅转深方案并保留颜色差异。另报告疑似关闭写信时崩溃，已先撤回19e7到dd712，
再继续颜色改进；统一灰色安装入口已禁用正向安装，仅保留回退。
故障数值与未决归因见`unread-scroll-fault-20261106.md`，不将新的关闭故障归为旧MSAA问题。

## 已采用：保留色相的多色转换

参考[Dark Reader官方前景色算法](https://github.com/darkreader/darkreader/blob/main/src/inject/dynamic-theme/modify-colors.ts)，
`editor-foreground-colors.js`保留完整MIT notice，采用HSL亮度调整，并作局部改编：
黑/中性深色趋向柔和浅灰#d8d8d8；保留彩色色相，不使用原算法的蓝色色相压缩，
不因深色本身就将高饱和度红绿蓝归灰。根据实际背景检查对比度，原本可读的彩色
文字保留；白色签名块保持其适合浅底的文字。透明文字保留透明度，未知图片/渐变
背景不强制转换，不宣称对这种背景保证对比。

`editor-screen-colors.js`从普通元素计算前景色和背景色，按转换结果为Text节点建立
不同的Custom Highlight分组；不改真实color或正文。透明背景按祖先合成到已有深色
纸面，缓存同时包含前景与有效背景，避免相同黑字在深/白区域混用结果。
光标通过独立constructed stylesheet的screen `:root {caret-color:...}`规则处理：
深底浅色、浅底深色。普通规则只涉及caret，正文颜色仍由独立高亮绘制。
没有新增STYLE，首STYLE及导出函数不变。pagehide/unload断开观察器、清除自有
高亮与范围并撤销自有样式表；恢复页面时重新注册。

新模板SHA256：`c3a898dcbccbe41d882c0b32bd28654d32a680ab0320ec4ec2d9b9a97d4eada8`。
23:06安装，EXE233e/helper0e47/Base.css8e56均不变。
入口`install-compose-screen-colors.ps1`支持预检、回退到dd712并正常重开。

验证：沿用固定hash的真实编辑器测试架构，12项实际导出、6类原生编辑命令开/关
对照完全相同；500个RGB×背景数学案例检查通过。补充确认蓝/红/绿与黑字有不同
显示色、深/浅背景光标正确、透明文字不显形、图片不被高亮范围覆盖，以及3轮合成
pagehide/pageshow无正文变化。仍未操作系统剪贴板或进行真实拖放测试。

用户实际确认“颜色和光标正常，关闭也正常”，覆盖写信、回复/转发打开与关闭。
因此保留c3a898模板作为采用版本。此前关闭崩溃尚未证明根因，本轮正常不能称为
已修复该故障；无依据安装native生命周期或MSAA新补丁。
