# young-tiny

使用 `tinypng api` 压缩图片

## 使用示例

### 安装
```cmd
npm i young-tiny -g
```

### 使用

#### 压缩指定目录下所有图片

```cmd
tiny src/
```

#### 压缩指定图片

```cmd
tiny one.png two.png
```

#### 将压缩图片生成至新目录
```cmd
tiny -b
or
tiny --b=dist
```

#### 生成压缩比信息
```cmd
tiny --md
```

#### 禁止重复压缩
```cmd
tiny --repeat=false
```
